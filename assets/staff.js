/* staff.html — the restaurant's own screen.
 *
 * Reached at staff.html?r=<place id>, bookmarked once on whatever phone or
 * tablet lives behind the counter. It shows the code the guest's page is
 * showing right now, for the evenings when the camera will not focus, the
 * guest's screen is cracked, or the cellar has no signal to load verify.html
 * on. Comparing five characters by eye is slower than scanning and quite a
 * lot faster than turning a guest away.
 */
(function () {
  'use strict';

  var P = window.TTBPass;
  var el = P.el;

  var card = document.getElementById('card');
  var placeId = new URLSearchParams(window.location.search).get('r') || '';
  var timer = null;

  function draw(data, deal, place, t) {
    var hour = P.hourNow();

    /* The current code and the one before it: the verifier accepts both, so
       the counter should be able to see both. */
    Promise.all([
      P.code(deal.key, placeId, hour),
      P.code(deal.key, placeId, hour - 1)
    ]).then(function (codes) {
      P.clear(card);

      if (!deal.live) {
        card.appendChild(el('p', { className: 'pass-flag', textContent: t('passNotLive') }));
      }

      card.appendChild(el('div', { className: 'pass-head' }, [
        el('p', { className: 'eyebrow', textContent: t('staffTitle') }),
        el('h1', { className: 'pass-name', textContent: place.name })
      ]));

      card.appendChild(el('p', { className: 'pass-code', textContent: codes[0] }));
      card.appendChild(el('p', {
        className: 'pass-clock',
        textContent: t('staffChanges', { time: P.clockOf(P.hourStart(hour + 1)) })
      }));

      card.appendChild(el('div', { className: 'staff-also' }, [
        el('p', { className: 'eyebrow', textContent: t('staffAlso') }),
        el('p', { className: 'pass-code', textContent: codes[1] })
      ]));

      card.appendChild(el('p', { className: 'pass-terms', textContent: t('staffNote') }));

      /* Redraw a moment after the hour turns, rather than polling. A tablet
         left on this page all evening keeps up on its own. */
      if (timer) clearTimeout(timer);
      timer = setTimeout(function () { draw(data, deal, place, t); }, P.untilNextHour() + 1000);
    }).catch(function () {
      P.clear(card);
      card.appendChild(el('p', { className: 'pass-lede', textContent: t('passInsecure') }));
    });
  }

  P.applyStyle();

  P.load().then(function (data) {
    var lang = P.pickLanguage(Object.keys(data.ui));
    var t = P.translator(data.ui, lang);
    document.documentElement.lang = lang;
    document.title = t('staffTitle') + ' | Tallinn Tastebuds';

    var deal = P.find(data.deals, placeId);
    var place = P.find(data.places, placeId);

    if (!deal || !place) {
      P.clear(card);
      card.appendChild(el('p', { className: 'pass-lede', textContent: t('passNone') }));
      /* Landing here with no place at all is the likeliest way in, so say
         what the address is missing rather than only that nothing was found. */
      if (!placeId) {
        card.appendChild(el('p', { className: 'pass-terms', textContent: t('staffPick') }));
      }
      return;
    }

    draw(data, deal, place, t);
  }).catch(function () {
    card.textContent = 'Something went wrong loading the data. Try refreshing the page.';
  });
}());
