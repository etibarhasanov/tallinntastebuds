/* deal.html — what the guest holds up.
 *
 * Reached at deal.html?r=<place id>. Draws the offer, a QR pointing at
 * verify.html, and the same code in type big enough to read out loud when a
 * camera will not focus. Redraws itself when the hour turns over, so a page
 * left open on a table is never showing a code that has just gone stale.
 */
(function () {
  'use strict';

  var P = window.TTBPass;
  var el = P.el;

  var card = document.getElementById('card');
  var placeId = new URLSearchParams(window.location.search).get('r') || '';

  var t = null;
  var timer = null;

  /* The running tick, so waking the phone can re-check immediately rather
     than waiting on an interval a backgrounded tab may have throttled. */
  var currentTick = null;
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden && currentTick) currentTick();
  });

  function backLink() {
    /* Back to the place on the map, not the top of it. */
    return el('a', {
      className: 'link-btn',
      href: './' + (placeId ? '?spot=' + encodeURIComponent(placeId) : ''),
      textContent: t('passBack')
    });
  }

  function message(text) {
    P.clear(card);
    card.appendChild(el('p', { className: 'pass-lede', textContent: text }));
    card.appendChild(el('div', { className: 'pass-foot' }, [backLink()]));
  }

  /* The countdown is the one moving thing on the page, and the only thing
     standing between this and a screenshot doing the same job. So it is
     drawn in the accent rather than the grey the rest of the small print
     uses, and a dot beats beside it: a waiter glancing for half a second
     catches a pulse where they might miss a digit.

     What decides a rollover is the hour, not the countdown reaching zero.
     untilNextHour never returns zero — it is HOUR minus a remainder, so its
     range is 1 to HOUR — and a phone that slept through the turn would wake
     to a fresh-looking countdown standing over a stale code. */
  function startClock(node, dot, hour, onRollover) {
    if (timer) clearInterval(timer);

    function tick() {
      if (P.hourNow() !== hour) { clearInterval(timer); onRollover(); return; }

      var left = P.untilNextHour();
      var mins = Math.floor(left / 60000);
      var secs = Math.floor((left % 60000) / 1000);
      node.textContent = mins + ':' + (secs < 10 ? '0' : '') + secs;

      /* Restart the beat on each tick so the dot and the digits move
         together. Left to its own CSS loop it drifts out of step with them
         within a minute, and two things blinking a second apart read as
         decoration rather than as one thing running. */
      dot.classList.remove('is-beat');
      void dot.offsetWidth;          /* reflow, so the animation can restart */
      dot.classList.add('is-beat');
    }

    currentTick = tick;
    tick();
    timer = setInterval(tick, 1000);
  }

  function draw(data, deal) {
    var hour = P.hourNow();

    P.code(deal.key, placeId, hour).then(function (value) {
      P.clear(card);

      if (!deal.live) {
        card.appendChild(el('p', { className: 'pass-flag', textContent: t('passNotLive') }));
      }

      card.appendChild(el('div', { className: 'pass-head' }, [
        el('p', { className: 'eyebrow', textContent: t('passHeading') }),
        el('h1', { className: 'pass-name', textContent: deal.name })
      ]));

      var offer = P.textFor(deal.offer, data.lang);
      if (offer) card.appendChild(el('p', { className: 'pass-lede', textContent: offer }));

      /* The QR carries the whole answer — which place, which hour, which code
         — so the waiter's phone needs nothing but a camera. */
      var wrap = el('div', { className: 'qr' });
      try {
        wrap.appendChild(window.TTBQR.svg(P.verifyUrl(placeId, hour, value)));
        card.appendChild(wrap);
        card.appendChild(el('p', { className: 'pass-clock', textContent: t('passScanMe') }));
      } catch (e) {
        /* No QR is survivable; the code below it says the same thing. */
      }

      card.appendChild(el('p', { className: 'pass-code', textContent: value }));

      /* aria-live off: the card around it is polite, and a countdown inside
         a live region is a screen reader announcing the seconds all evening. */
      var tick = el('span', { className: 'pass-tick', 'aria-live': 'off' });
      var dot = el('span', { className: 'live-dot', 'aria-hidden': 'true' });
      card.appendChild(el('p', { className: 'pass-live' }, [dot, tick]));

      card.appendChild(el('p', {
        className: 'pass-clock',
        textContent: t('passUntil', { time: P.clockOf(P.hourStart(hour + 1)) })
      }));
      startClock(tick, dot, hour, function () { draw(data, deal); });

      var terms = P.textFor(deal.terms, data.lang);
      if (terms) card.appendChild(el('p', { className: 'pass-terms', textContent: terms }));

      card.appendChild(el('div', { className: 'pass-foot' }, [backLink()]));
    }).catch(function () {
      /* crypto.subtle is absent outside a secure context, which in practice
         means someone opened the file straight off the disk. */
      message(t('passInsecure'));
    });
  }

  P.applyStyle();

  P.load().then(function (data) {
    data.lang = P.pickLanguage(Object.keys(data.ui));
    t = P.translator(data.ui, data.lang);
    document.documentElement.lang = data.lang;
    document.title = t('passTitle') + ' | Tallinn Tastebuds';

    var deal = P.find(data.deals, placeId);
    if (!deal) { message(t('passNone')); return; }

    var run = P.windowState(deal);
    if (run === 'notyet') { message(t('verifyNotYetNote')); return; }
    if (run === 'ended') { message(t('verifyEndedNote')); return; }

    draw(data, deal);
  }).catch(function () {
    card.textContent = 'Something went wrong loading the data. Try refreshing the page.';
  });
}());
