/* Tallinn Tastebuds — Microsoft Clarity, said once.
 *
 * Clarity records the page rather than counting it: heatmaps of where
 * presses and scrolls land, and a replay of the DOM as it changed through a
 * visit. The counting is the site's own — assets/track.js reports to
 * /api/stats, and /admin/visitors is drawn from that — so this file is the
 * only third party left watching. It loads on every page but admin.html —
 * the list at the top of tools/stamp.mjs — and from here rather than from a
 * snippet pasted into each head, which would be Microsoft's block in every
 * one of them and one id to change in as many places as there are pages.
 * Same reason assets/track.js exists rather than seven copies of three
 * functions.
 *
 * GOOGLE ANALYTICS WAS THE OTHER HALF, AND IT IS GONE
 *
 * This file loaded Google's tag too, until 30 September 2026, when the owner
 * took it out: the site's own count had come to answer everything GA was
 * open in a tab for, without a third party's cookie on every visitor's
 * device. The filename is the one every page's head already names, so it
 * stayed rather than seventeen pages changing to say "clarity".
 *
 * THERE WAS A CONSENT BAR HERE, AND IT WAS TAKEN OUT ON PURPOSE
 *
 * For a day this file was assets/consent.js and it asked before either tag
 * loaded — first as a bar with one sentence, then as a dialog listing what
 * was used regardless and what agreeing added on top. Neither is here now.
 * That was the owner's decision, made after the case for keeping it, and it
 * is written down so the next session does not spend an afternoon deciding it
 * was an oversight:
 *
 * ePrivacy, which Estonia applies, asks whether you wrote to somebody's
 * device — not whether what you wrote was personal data — and analytics
 * cookies are not "strictly necessary". This file writes `_clck` and `_clsk`
 * with nobody asked, and a session replay is a recording of somebody's
 * visit. Putting the question back is a revert, not a
 * discussion: `git log` has both versions of it, and the reasoning with them.
 *
 * WHY consentv2 GOES OUT WITH NOTHING IN FRONT OF IT
 *
 * Since 31 October 2025 Clarity gives a visitor in the EEA, the UK or
 * Switzerland full recording only against a consentv2 signal. Without one it
 * drops to a limited mode where every page load is a fresh session and a
 * returning visitor is nobody it has seen before. This is a map of Tallinn:
 * practically every visitor is one of those, and that mode turns the replay
 * of a visit into a heap of one-page fragments — the opposite of the thing
 * Clarity is here for. So the signal is sent unconditionally.
 *
 * TO REMOVE CLARITY
 *
 * Delete this file's script tag from every page that carries it, and the
 * file. assets/track.js checks for window.clarity before every call and goes
 * on counting without it — written for visitors running an ad blocker, and
 * it covers this too — so none of the call sites has to change.
 *
 * NOT ON admin.html
 *
 * The only visits it could record are the owner's own, which answer no
 * question anybody asked of the numbers, and it is the one page that holds a
 * GitHub token. The token never reaches a replay anyway — Clarity masks every
 * input box in all three of its masking modes and nothing renders the token
 * as anything else — but a page nobody but the owner opens has nothing to say
 * about how the map is used.
 */
(function () {
  'use strict';

  var CLARITY = 'yay3pxtg4w';

  /* Microsoft's snippet, as its console emits it. window.clarity is a queue
     until its script lands, so a TTBTrack call in the same tick queues
     rather than falling on the floor. */
  (function (c, l, a, r, i, t, y) {
    c[a] = c[a] || function () { (c[a].q = c[a].q || []).push(arguments); };
    t = l.createElement(r); t.async = 1; t.src = 'https://www.clarity.ms/tag/' + i;
    y = l.getElementsByTagName(r)[0]; y.parentNode.insertBefore(t, y);
  })(window, document, 'clarity', 'script', CLARITY);

  /* consentv2, not the older clarity('consent') — that one is deprecated, and
     it is this call that keeps an EEA visit one replay instead of one per
     page. Queued, which is what the queue above is for.

     BOTH SPELLINGS OF EACH KEY, ON PURPOSE. Microsoft documents them with a
     capital S — ad_Storage, analytics_Storage — which is not how Google's
     consent mode spells the same two ideas, and Google's is the spelling in
     everyone's muscle memory. microsoft/clarity#924 is somebody who sent the
     lowercase pair, got empty cookies and a fresh "user" on every page load,
     and it is open with no answer. Nobody outside Microsoft can say which one
     is read; the failure is silent and looks exactly like the fragmentation
     this call exists to prevent. An object key Clarity ignores costs nothing,
     and a guess that went the wrong way would cost the recordings.

     ad_Storage is DENIED. It is what lets Clarity set MUID, a Microsoft-wide
     identifier shared with their advertising side, and this site carries no
     advertising of any kind — so there is nothing here for it to do. The cost
     is one thing and it is small: the recordings and the heatmaps ride on
     analytics_Storage and arrive either way, and what is lost is Clarity's
     surest way of telling a returning visitor from a new one. Grant it if
     that trade ever stops being worth it; it is one word. */
  window.clarity('consentv2', {
    ad_Storage: 'denied',
    analytics_Storage: 'granted',
    ad_storage: 'denied',
    analytics_storage: 'granted'
  });
})();
