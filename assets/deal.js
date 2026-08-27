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

  /* The countdown is the one moving thing on the page. It is here to be
     looked at rather than read: a screenshot has a frozen one, and that is
     the difference a waiter can see without checking anything. */
  function startClock(node, onRollover) {
    if (timer) clearInterval(timer);

    function tick() {
      var left = P.untilNextHour();
      if (left <= 0) { clearInterval(timer); onRollover(); return; }
      var mins = Math.floor(left / 60000);
      var secs = Math.floor((left % 60000) / 1000);
      node.textContent = mins + ':' + (secs < 10 ? '0' : '') + secs;
    }
    tick();
    timer = setInterval(tick, 1000);
  }

  function draw(data, deal, place) {
    var hour = P.hourNow();

    P.code(deal.key, placeId, hour).then(function (value) {
      P.clear(card);

      if (!deal.live) {
        card.appendChild(el('p', { className: 'pass-flag', textContent: t('passNotLive') }));
      }

      card.appendChild(el('div', { className: 'pass-head' }, [
        el('p', { className: 'eyebrow', textContent: t('passHeading') }),
        el('h1', { className: 'pass-name', textContent: place.name })
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

      var tick = el('span', { className: 'pass-tick' });
      card.appendChild(el('p', { className: 'pass-clock' }, [
        t('passUntil', { time: P.clockOf(P.hourStart(hour + 1)) }),
        '  ·  ',
        tick
      ]));
      startClock(tick, function () { draw(data, deal, place); });

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
    var place = P.find(data.places, placeId);
    if (!deal || !place) { message(t('passNone')); return; }

    var run = P.windowState(deal);
    if (run === 'notyet') { message(t('verifyNotYetNote')); return; }
    if (run === 'ended') { message(t('verifyEndedNote')); return; }

    draw(data, deal, place);
  }).catch(function () {
    card.textContent = 'Something went wrong loading the data. Try refreshing the page.';
  });
}());
