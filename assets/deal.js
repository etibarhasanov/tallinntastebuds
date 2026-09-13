/* deal.html — what the guest holds up.
 *
 * Reached at deal.html?r=<place id>. Draws the offer, a QR pointing at
 * verify.html, and the same code in type big enough to read out loud when a
 * camera will not focus. Redraws itself when the hour turns over, so a page
 * left open on a table is never showing a code that has just gone stale —
 * and, on a deal with a roll, so that the new hour's rate is drawn in front
 * of whoever is still looking.
 *
 * Nothing is shown at all until TTBPass.admit() says the person holding the
 * page is signed in: a discount is for members. The card it draws instead is
 * the offer and the way in, because somebody who followed a link here should
 * still learn what is on offer — and the same goes for the answers further
 * down, a deal that has not started, one that has finished, a page opened
 * off the disk, and the gate itself being unreachable.
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
    return TTBTrack.click(el('a', {
      className: 'link-btn',
      href: './' + (placeId ? '?spot=' + encodeURIComponent(placeId) : ''),
      textContent: t('passBack')
    }), 'pass_back', { place: placeId });
  }

  function message(text) {
    P.clear(card);
    card.appendChild(el('p', { className: 'pass-lede', textContent: text }));
    card.appendChild(el('div', { className: 'pass-foot' }, [backLink()]));
  }

  /* Signed out, which every discount now is until somebody signs in — see
     functions/api/pass.js. The offer is still shown, because it is what the
     person came to read and it is on the map anyway; what is missing is the
     code, and the button is the way to it. It opens the map's sign-in sheet
     with this page as the place to come back to, the road the lists page
     takes, so signing in lands here with the pass made rather than on the
     map wondering where they were.

     A rolled deal says it differently: there is a rate to draw rather than
     one waiting, and the button is the draw. */
  function signIn(data, deal) {
    var rolled = !!P.rates(deal);
    P.clear(card);
    if (!deal.live) {
      card.appendChild(el('p', { className: 'pass-flag', textContent: t('passNotLive') }));
    }
    card.appendChild(el('div', { className: 'pass-head' }, [
      el('p', { className: 'eyebrow', textContent: t('passOffer') }),
      el('h1', { className: 'pass-name', textContent: deal.name })
    ]));
    card.appendChild(el('p', { className: 'pass-lede', textContent: P.offerText(deal, data.lang) }));
    card.appendChild(el('p', { className: 'pass-terms', textContent: t(rolled ? 'passRollSignIn' : 'passSignIn') }));
    card.appendChild(el('div', { className: 'pass-foot' }, [
      TTBTrack.click(el('a', {
        className: 'link-btn is-primary',
        href: '/?account=in&then=' + encodeURIComponent(window.location.pathname + window.location.search),
        textContent: t(rolled ? 'dealRollSignIn' : 'dealSignIn')
      }), 'pass_signin', { place: placeId }),
      backLink()
    ]));
  }

  /* The rate is drawn in front of the guest rather than stated: the number
     runs through the whole run for a second and lands on theirs, so what
     they see is a draw and not a price list. It lands on the same number
     however it runs — the draw was made before the first flip — and for
     somebody who has asked for less motion it simply appears. */
  var TUMBLE_FLIPS = 14;
  var TUMBLE_MS = 70;

  function tumble(node, run, rate) {
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      node.textContent = rate;
      return;
    }
    var flips = 0;
    var spin = setInterval(function () {
      flips++;
      if (flips < TUMBLE_FLIPS) { node.textContent = run[flips % run.length]; return; }
      clearInterval(spin);
      node.textContent = rate;
    }, TUMBLE_MS);
  }

  /* The offer line with the drawn rate set into it where the deal wrote
     {rate}, in a span of its own so the draw can be watched landing. The
     sign, and which side of the number it stands on, are the line's own —
     Turkish writes %15 — so the span holds the number and nothing else. */
  function rolledLede(offer, run, rate) {
    var parts = offer.split('{rate}');
    var number = el('span', { className: 'pass-rate' });
    var lede = el('p', { className: 'pass-lede is-rolled' }, [
      parts[0], number, parts.slice(1).join(String(rate))
    ]);
    tumble(number, run, rate);
    return lede;
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
    var run = P.rates(deal);
    var rate;

    /* The door first, then the code — and on a rolled deal the same request
       is the draw, because the code is made around the rate it comes back
       with. A fixed deal draws nothing and its code is the one it always
       was; it still has to knock. */
    P.admit(deal, placeId).then(function (drawn) {
      rate = drawn;
      return P.code(deal.key, placeId, hour, rate);
    }).then(function (value) {
      P.clear(card);
      /* Not a press, but the one moment this page exists for: a code was
         put in front of somebody. Once per hour on a page left open. */
      var shown = { place: deal.name, live: deal.live ? 'yes' : 'no' };
      if (run) shown.rate = rate;
      TTBTrack.event('pass_shown', shown);

      if (!deal.live) {
        card.appendChild(el('p', { className: 'pass-flag', textContent: t('passNotLive') }));
      }

      card.appendChild(el('div', { className: 'pass-head' }, [
        el('p', { className: 'eyebrow', textContent: t('passHeading') }),
        el('h1', { className: 'pass-name', textContent: deal.name })
      ]));

      var offer = P.textFor(deal.offer, data.lang);
      if (run) card.appendChild(rolledLede(offer, run, rate));
      else if (offer) card.appendChild(el('p', { className: 'pass-lede', textContent: offer }));

      /* The QR carries the whole answer — which place, which hour, which code,
         and on a rolled deal which rate — so the waiter's phone needs nothing
         but a camera. */
      var wrap = el('div', { className: 'qr' });
      try {
        wrap.appendChild(window.TTBQR.svg(P.verifyUrl(placeId, hour, value, rate)));
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

      /* On a rolled deal the hour turning is also the next draw, and the
         line says so: it is the one thing about the roll a guest can act on. */
      card.appendChild(el('p', {
        className: 'pass-clock',
        textContent: t(run ? 'passRollUntil' : 'passUntil', { time: P.clockOf(P.hourStart(hour + 1)) })
      }));
      startClock(tick, dot, hour, function () { draw(data, deal); });

      var terms = P.textFor(deal.terms, data.lang);
      if (terms) card.appendChild(el('p', { className: 'pass-terms', textContent: terms }));

      card.appendChild(el('div', { className: 'pass-foot' }, [backLink()]));
    }).catch(function (err) {
      var why = err && err.message;
      if (why === 'sign-in') { signIn(data, deal); return; }
      /* crypto.subtle is absent outside a secure context, which in practice
         means someone opened the file straight off the disk. Anything else
         is /api/pass not answering — a deploy without its bindings, a
         connection that dropped — and the page says so rather than showing a
         code, because a discount that appeared whenever that request failed
         would not be for members at all. */
      message(t(why === 'insecure-context' ? 'passInsecure' : 'passUnavailable'));
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

    var dates = P.windowState(deal);
    if (dates === 'notyet') { message(t('verifyNotYetNote')); return; }
    if (dates === 'ended') { message(t('verifyEndedNote')); return; }

    draw(data, deal);
  }).catch(function () {
    card.textContent = 'Something went wrong loading the data. Try refreshing the page.';
  });
}());
