/* Tallinn Tastebuds — the about page.
 *
 * One person's page of links, the way a Linktree is: a face, a name, the
 * showreel, the CV, the agency, the commercials and the sketches. Everything
 * on it is written into about.html as a link to the thing itself, so the page
 * is a working list of addresses before this file runs and after it fails.
 * What this file adds is three things a list of links cannot do:
 *
 *   - a row carrying data-play opens its player inside its own card, rather
 *     than walking away to YouTube or Vimeo to be watched;
 *   - the CV row opens the CV as a sheet over the page;
 *   - the Share button hands the address on.
 *
 * WHY EVERY WORD ON IT IS ENGLISH
 *
 * Every other page here prints its words out of data/ui.json in ten
 * languages, and this one deliberately does not. What it says is somebody's
 * CV and the names of their work — content, the way a post on the blog is
 * content, and written in the one language the people it is for read it in.
 * What is left over is interface, and it is four words: Share, Close, Link
 * copied, and the way out under a player. That file is 344 KB, and fetching
 * all of it to translate four words around an English CV would make this the
 * heaviest thing on the page. **About** in README.md says what translating it
 * would take, if that ever changes.
 *
 * THE PLAYERS ARE NOT OURS, AND NONE OF THEM CAN BE CHECKED FROM HERE
 *
 * YouTube, Vimeo, Google Drive and Instagram each decide for themselves what
 * their frame shows on somebody else's site: an owner can switch embedding
 * off, a Drive file has to be shared with anybody who has the link, and
 * Instagram shows a phone a card rather than a player. So every player has
 * the way out printed under it, to the same address the row carries, and it
 * goes in the same tab — an instagram.com or youtube.com address is a
 * universal link, and a new tab left behind by the app opening is the blank
 * page somebody comes back to. reelFallback() in assets/app.js is where that
 * was learnt.
 *
 * ES5, one IIFE, like every other file in assets/.
 */
(function () {
  'use strict';

  var STYLES = ['red', 'green'];
  var DEFAULT_STYLE = 'red';
  var STYLE_KEY = 'ttb.style';

  /* The map's own line between a phone and everything else — isNarrow() in
     assets/app.js — because the one thing it decides here is the one thing
     it decides there: whether Instagram gets a frame at all. */
  var PHONE = '(max-width: 860px)';

  var toastTimer = null;

  function storeGet(key) {
    try { return window.localStorage.getItem(key); } catch (e) { return null; }
  }

  /* The block every page carries, the style half of it: ?style=, else the
     one the map stored, else red; then the colour scheme the browser's own
     controls are drawn in, and the wash written into the browser's chrome. */
  function applyStyle() {
    var fromUrl = new URLSearchParams(window.location.search).get('style');
    var stored = storeGet(STYLE_KEY);
    var style = STYLES.indexOf(fromUrl) !== -1 ? fromUrl
              : STYLES.indexOf(stored) !== -1 ? stored
              : DEFAULT_STYLE;

    document.documentElement.setAttribute('data-style', style);
    document.documentElement.style.colorScheme = style === 'green' ? 'dark' : 'light';

    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      var wash = getComputedStyle(document.documentElement).getPropertyValue('--wash').trim();
      if (wash) meta.setAttribute('content', wash);
    }
  }

  /* An open CV is in the browser's top layer, above every z-index the page
     has, so a toast said from inside it is moved inside it to be seen. */
  function toast(message) {
    var node = document.getElementById('toast');
    var sheet = document.getElementById('cv');
    (sheet.open ? sheet : document.body).appendChild(node);
    node.textContent = message;
    node.hidden = false;
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { node.hidden = true; }, 3800);
  }

  /* The share sheet on a phone and the clipboard on a laptop, decided by the
     pointer rather than by whether navigator.share exists — every desktop
     browser has it now, and its sheet there has no "copy link" in it.
     shareList() in assets/lists.js has the argument. */
  function share(url, where) {
    if (navigator.share && window.matchMedia('(pointer: coarse)').matches) {
      TTBTrack.event('about_share', { where: where, method: 'sheet' });
      navigator.share({ title: document.title, url: url }).catch(function () { /* dismissed */ });
      return;
    }
    TTBTrack.event('about_share', { where: where, method: 'copy' });
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url)
        .then(function () { toast('Link copied.'); })
        .catch(function () { window.prompt('Share', url); });
      return;
    }
    window.prompt('Share', url);
  }

  /* ---------------------------------------------------------------- players
   * A row's player goes into its own card, under the row, and comes out
   * again on the second press. Taking the frame out rather than hiding it is
   * what stops the sound: none of these players can be paused from here
   * without its own script, and a frame that is not in the page is not
   * playing.
   *
   * A reel is tall and everything else is a screen's shape. Instagram's frame
   * opens at the shape of a reel with its own chrome round it and is then
   * corrected by the measurement it posts out, below. */
  function openPlayer(row) {
    var host = row.getAttribute('data-host');
    var tall = host === 'Instagram';

    var frame = document.createElement('div');
    frame.className = 'about-frame' + (tall ? ' is-tall' : '');
    var iframe = document.createElement('iframe');
    iframe.src = row.getAttribute('data-play');
    iframe.title = row.querySelector('.menu-name').textContent;
    iframe.setAttribute('allow', 'autoplay; clipboard-write; encrypted-media; picture-in-picture; fullscreen');
    iframe.setAttribute('allowfullscreen', '');
    iframe.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
    frame.appendChild(iframe);

    var out = document.createElement('a');
    out.href = row.href;
    out.textContent = 'Open it on ' + host;
    TTBTrack.click(out, 'about_link', { item: row.getAttribute('data-item'), from: 'player' });

    var fallback = document.createElement('p');
    fallback.className = 'about-out';
    fallback.appendChild(document.createTextNode('Trouble loading? '));
    fallback.appendChild(out);
    fallback.appendChild(document.createTextNode('.'));

    var player = document.createElement('div');
    player.className = 'about-player';
    player.appendChild(frame);
    player.appendChild(fallback);
    row.parentNode.appendChild(player);
    row.setAttribute('aria-expanded', 'true');
  }

  function closePlayer(row) {
    row.parentNode.removeChild(row.parentNode.querySelector('.about-player'));
    row.setAttribute('aria-expanded', 'false');
  }

  /* Rows are upgraded once, on load, and not again if the window is turned or
     resized afterwards: a row that stopped being a button halfway through a
     visit would be stranger than one that stays what it was. */
  function wirePlayers() {
    var phone = window.matchMedia(PHONE).matches;
    var rows = document.querySelectorAll('.about-row[data-play]');

    Array.prototype.forEach.call(rows, function (row) {
      var item = row.getAttribute('data-item');

      if (phone && row.getAttribute('data-host') === 'Instagram') return;

      row.setAttribute('role', 'button');
      row.setAttribute('aria-expanded', 'false');
      row.addEventListener('click', function (ev) {
        ev.preventDefault();
        if (row.getAttribute('aria-expanded') === 'true') {
          closePlayer(row);
          return;
        }
        TTBTrack.event('about_play', { item: item });
        openPlayer(row);
      });
      /* A link answers Enter and not Space; a button answers both, and this
         is a button now. */
      row.addEventListener('keydown', function (ev) {
        if (ev.key !== ' ') return;
        ev.preventDefault();
        row.click();
      });

      /* The showreel is the reason most people are here, so it is standing
         open when they arrive rather than one press away. Not counted as a
         play: nobody pressed anything. */
      if (row.hasAttribute('data-open')) openPlayer(row);
    });
  }

  /* Instagram's frame posts its own height out once it has drawn. The same
     listener as wireReelMeasure() in assets/app.js, over this page's frames
     rather than the panel's — two files that cannot import from each other,
     and ten lines each. */
  function wireMeasure() {
    window.addEventListener('message', function (ev) {
      if (!/^https:\/\/(www\.)?instagram\.com$/.test(ev.origin)) return;

      var frames = document.querySelectorAll('.about-frame.is-tall iframe');
      var frame = null;
      for (var i = 0; i < frames.length; i++) {
        if (frames[i].contentWindow === ev.source) { frame = frames[i]; break; }
      }
      if (!frame) return;

      var data = ev.data;
      if (typeof data === 'string') {
        try { data = JSON.parse(data); } catch (e) { return; }
      }

      var details = (data && data.details) || data;
      var height = Number(details && details.height);
      var width = frame.offsetWidth;
      if (!height || !width || height < 100) return;

      frame.parentNode.style.aspectRatio = width + ' / ' + height;
    });
  }

  /* --------------------------------------------------------------------- CV
   * The address says whether it is open — /about#cv — so the link the CV's
   * own Share hands out arrives with the CV already up, and closing it takes
   * the #cv back off without adding a step to Back. */
  function wireCv() {
    var sheet = document.getElementById('cv');
    var bare = window.location.pathname + window.location.search;

    function open() {
      if (!sheet.open) sheet.showModal();
      if (window.location.hash !== '#cv') history.replaceState(null, '', bare + '#cv');
    }

    document.querySelector('.about-row[data-item="cv"]').addEventListener('click', function (ev) {
      ev.preventDefault();
      TTBTrack.event('about_cv');
      open();
    });

    Array.prototype.forEach.call(sheet.querySelectorAll('[data-cv-close]'), function (button) {
      button.addEventListener('click', function () { sheet.close(); });
    });

    /* A press on the ground round the card lands on the dialog itself. */
    sheet.addEventListener('click', function (ev) {
      if (ev.target === sheet) sheet.close();
    });

    /* Escape closes it without passing through either button, so the address
       is put back here rather than in them. */
    sheet.addEventListener('close', function () {
      history.replaceState(null, '', bare);
    });

    document.getElementById('cv-share').addEventListener('click', function () {
      share(window.location.origin + '/about#cv', 'cv');
    });

    if (window.location.hash === '#cv') open();
  }

  applyStyle();
  wirePlayers();
  wireMeasure();
  wireCv();

  var shareButton = document.getElementById('about-share');
  shareButton.hidden = false;
  shareButton.addEventListener('click', function () {
    share(window.location.origin + '/about', 'page');
  });

  /* Whatever is still a plain link once the players are wired — the agency,
     the email, Swappie's page, and a reel on a phone — reports as it leaves. */
  Array.prototype.forEach.call(document.querySelectorAll('.about-row:not([role]):not([data-item="cv"])'), function (row) {
    TTBTrack.click(row, 'about_link', { item: row.getAttribute('data-item'), from: 'row' });
  });
})();
