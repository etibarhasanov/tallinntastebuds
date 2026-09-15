/* Tallinn Tastebuds — nothing analytics loads until somebody says yes.
 *
 * This file is the gate and everything behind it. The two tags used to load
 * on their own — Google's pasted into eight heads, Microsoft Clarity's from a
 * file beside this one — and both are here now instead, because the moment a
 * choice stands in front of them they stop being two independent things and
 * become one question: does this visitor want to be measured.
 *
 * WHY A BANNER, ON A SITE THAT SPENT YEARS NOT WANTING ONE
 *
 * What changed is not the law but the enforcement. Since 31 October 2025
 * Clarity itself withholds full recording from visitors in the EEA, the UK
 * and Switzerland unless it is handed a consent signal, and falls back to a
 * limited mode in which every page load is a fresh session and a returning
 * visitor is nobody it has seen before. This is a map of Tallinn. Practically
 * all of its traffic is the EEA, so without this file the recordings arrive
 * as a heap of one-page fragments — which is exactly the thing Clarity was
 * added to see past.
 *
 * So the bar is not only a compliance chore, and that is the part worth
 * knowing before somebody decides to take it out again: it is what makes a
 * replay follow one person from the map into a place into the discount,
 * rather than stopping at each page boundary.
 *
 * WHAT IT GATES
 *
 * Everything. Undecided means no gtag, no Clarity, no request to either, and
 * therefore no `_ga`, `_clck`, `_clsk` or `MUID` written to the device. That
 * last one is the reason this is not an over-reaction to a counter: MUID is a
 * Microsoft-wide identifier shared with their advertising side, and it is not
 * something to hand over on somebody's behalf without asking them.
 *
 * "Did you write to somebody's device without asking" is the test ePrivacy
 * actually applies, rather than "is any of it personal data" — which is why
 * "we do not collect anything" was never the answer it sounded like.
 *
 * assets/track.js needs no change and got none. Everything in it already
 * checks for window.gtag and returns quietly when it is missing; that was
 * written for visitors running an ad blocker, and it describes a visitor who
 * said no just as exactly. So every TTBTrack call site on all eight pages is
 * a harmless no-op until somebody presses Allow, and none of them had to
 * learn about consent.
 *
 * THE ANSWER LIVES IN localStorage, NOT IN A COOKIE
 *
 * `ttb.consent`, "yes" or "no", beside the other seven `ttb.*` keys. A cookie
 * recording that somebody refused cookies is a joke the rules would actually
 * permit — a consent record is strictly necessary — but every other choice
 * this site remembers is in localStorage already, and nobody reading this
 * should have to learn a second mechanism to find one answer.
 *
 * There is no "change your mind" control, because there is no settings page
 * to put one on and inventing one for this would be a page nobody opens.
 * Clearing site data clears the answer and the bar comes back, which is the
 * same way every other `ttb.*` key is undone.
 *
 * WHY THE STRINGS ARE FETCHED RATHER THAN WRITTEN IN HERE
 *
 * `data/ui.json`, like every string on this site. The rule in the /site skill
 * has exactly one exception and this was not going to be the second. It costs
 * a fetch, but only on the single load where nobody has answered yet: a
 * visitor who already said yes is decided synchronously out of localStorage
 * before this file touches the network, so the tags on a return visit start
 * as early as they did when they were pasted into the head.
 *
 * NOT ON admin.html
 *
 * That page carries neither tag any more. The only visits it could record are
 * the owner's own, which answer no question anybody asked of the analytics;
 * it is the one page holding a GitHub token, which now stays out of a replay
 * because there is no replay rather than because Clarity masks input boxes;
 * and it does not load assets/styles.css — it carries its own — so the bar
 * would have had to be styled a second time. Three reasons pointing one way.
 */
(function () {
  'use strict';

  var GA = 'G-2XNTC15F28';
  var CLARITY = 'yay3pxtg4w';
  var KEY = 'ttb.consent';
  var LANG_KEY = 'ttb.lang';
  var DEFAULT_LANG = 'en';

  /* Root-relative on purpose. lists.html is also served at /list/<id> and
     /u/<name>, where a relative "data/ui.json" resolves under that path and
     404s — the same reason those pages write their asset URLs from the root.
     See the head of tools/stamp.mjs. */
  var UI_URL = '/data/ui.json';

  function storeGet(key) {
    try { return window.localStorage.getItem(key); } catch (e) { return null; }
  }

  function storeSet(key, value) {
    try { window.localStorage.setItem(key, value); } catch (e) { /* private mode */ }
  }

  /* Google's snippet and Microsoft's, each as its console emits it, run back
     to back. Both define their global synchronously — only the scripts they
     fetch are async — so a TTBTrack call in the same tick still queues rather
     than falling on the floor. */
  function loadTags() {
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag('js', new Date());
    window.gtag('config', GA);
    var g = document.createElement('script');
    g.async = true;
    g.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA;
    document.head.appendChild(g);

    (function (c, l, a, r, i, t, y) {
      c[a] = c[a] || function () { (c[a].q = c[a].q || []).push(arguments); };
      t = l.createElement(r); t.async = 1; t.src = 'https://www.clarity.ms/tag/' + i;
      y = l.getElementsByTagName(r)[0]; y.parentNode.insertBefore(t, y);
    })(window, document, 'clarity', 'script', CLARITY);

    /* Clarity's own consent signal, and the line this whole file turns on.
       Loading the tag only after a yes already means nothing was written
       before one — but Clarity holds back full recording from an EEA visitor
       until it is told consent exists, and being told is the difference
       between one replay per visit and one per page load.

       It is consentv2 and not the older clarity('consent'): that one is
       deprecated, and since 31 October 2025 an EEA, UK or Swiss visitor only
       gets full recording against a v2 signal.

       BOTH SPELLINGS OF EACH KEY, ON PURPOSE. Microsoft documents them with a
       capital S — ad_Storage, analytics_Storage — which is not how Google's
       consent mode spells the same two ideas, and the muscle memory is
       Google's. microsoft/clarity#924 is somebody who sent the lowercase pair,
       got empty cookies and a fresh "user" on every page load, and it is open
       with no answer. That failure is silent and looks exactly like the
       fragmentation this file exists to prevent, so both go in: an object key
       Clarity does not read costs nothing, and a guess that went the wrong way
       would cost the recordings.

       Queued rather than waited for: the snippet above defines window.clarity
       as a queue before its script arrives, which is what that queue is for.

       ad_Storage is granted alongside analytics_Storage, which is the owner's
       call and worth knowing rather than assuming — it is what lets Clarity
       set MUID, a Microsoft-wide identifier shared with their advertising
       side. Deny it here and the recordings stay; what goes is Clarity's
       surest way of telling a returning visitor from a new one. */
    window.clarity('consentv2', {
      ad_Storage: 'granted',
      analytics_Storage: 'granted',
      ad_storage: 'granted',
      analytics_storage: 'granted'
    });
  }

  /* The same order every page boots with: ?lang=, then the choice the map
     wrote down, then what the browser asks for, then English. Copied rather
     than shared because this file runs on pages whose own script has not
     started yet, and on deal.html, which has no pickLanguage of its own. */
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

  /* A sentence and two buttons, which is the shape .nudge already had — so it
     is drawn to look like one, and the stylesheet says why it cannot simply
     be one. The bar takes itself off screen; what the answer then means is
     the caller's business, not the bar's. */
  function draw(t, answer) {
    var box = document.createElement('div');
    box.className = 'consent';
    box.setAttribute('role', 'region');
    box.setAttribute('aria-labelledby', 'consent-say');

    var say = document.createElement('p');
    say.className = 'consent-say';
    say.id = 'consent-say';
    say.textContent = t('consentSay');

    function choose(said) {
      if (box.parentNode) box.parentNode.removeChild(box);
      answer(said);
    }

    var yes = document.createElement('button');
    yes.type = 'button';
    yes.className = 'consent-yes';
    yes.textContent = t('consentYes');
    yes.addEventListener('click', function () { choose('yes'); });

    var no = document.createElement('button');
    no.type = 'button';
    no.className = 'consent-no';
    no.textContent = t('consentNo');
    no.addEventListener('click', function () { choose('no'); });

    var row = document.createElement('div');
    row.className = 'consent-row';
    row.appendChild(yes);
    row.appendChild(no);

    box.appendChild(say);
    box.appendChild(row);
    return box;
  }

  function ask() {
    fetch(UI_URL).then(function (res) {
      return res.ok ? res.json() : null;
    }).then(function (ui) {
      if (!ui) return;
      var strings = ui[pickLanguage(Object.keys(ui))];

      /* No bar rather than a bar reading "consentSay". The validator holds
         every language to the same keys, so this is the shape of a ui.json
         that failed to load rather than one a language is missing from. */
      if (!strings || !strings.consentSay) return;

      document.body.appendChild(draw(
        function (key) { return strings[key]; },
        function (said) {
          storeSet(KEY, said);
          if (said === 'yes') loadTags();
        }
      ));
    }).catch(function () { /* no strings, no bar, no tags */ });
  }

  var said = storeGet(KEY);
  if (said === 'yes') loadTags();
  else if (said !== 'no') ask();
})();
