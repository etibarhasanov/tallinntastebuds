/* staff.html — the restaurant's own screen.
 *
 * Reached at staff.html?r=<place id>, bookmarked once on whatever phone or
 * tablet lives behind the counter. It shows the code the guest's page is
 * showing right now, for the evenings when the camera will not focus, the
 * guest's screen is cracked, or the cellar has no signal to load verify.html
 * on. Comparing five characters by eye is slower than scanning and quite a
 * lot faster than turning a guest away.
 *
 * A deal with a roll has a code per rate rather than one an hour, and this
 * page lists them all: the counter reads the guest's five characters down
 * the list and finds the rate beside them, which is how a code drawn for 10%
 * is not read as 25% by anybody.
 */
(function () {
  'use strict';

  var P = window.TTBPass;
  var el = P.el;

  var card = document.getElementById('card');
  var placeId = new URLSearchParams(window.location.search).get('r') || '';
  var timer = null;

  /* One code for a fixed deal; for a rolled deal, a row per rate with its
     code beside it, lowest rate first, the order the guest's page tumbles
     through them. */
  function codes(run, values) {
    if (!run) return el('p', { className: 'pass-code', textContent: values[0] });
    return el('ul', { className: 'staff-rates' }, run.map(function (rate, i) {
      return el('li', { className: 'staff-rate' }, [
        el('span', { className: 'staff-rate-pct', textContent: rate + '%' }),
        el('span', { className: 'pass-code', textContent: values[i] })
      ]);
    }));
  }

  function draw(data, deal, t) {
    var hour = P.hourNow();
    var run = P.rates(deal);

    /* The current code and the one before it: the verifier accepts both, so
       the counter should be able to see both. On a rolled deal that is a set
       for each hour, one code per rate. */
    function codesFor(h) {
      return Promise.all((run || [undefined]).map(function (rate) {
        return P.code(deal.key, placeId, h, rate);
      }));
    }

    Promise.all([codesFor(hour), codesFor(hour - 1)]).then(function (sets) {
      P.clear(card);

      if (!deal.live) {
        card.appendChild(el('p', { className: 'pass-flag', textContent: t('passNotLive') }));
      }

      card.appendChild(el('div', { className: 'pass-head' }, [
        el('p', { className: 'eyebrow', textContent: t(run ? 'staffCodes' : 'staffTitle') }),
        el('h1', { className: 'pass-name', textContent: deal.name })
      ]));

      card.appendChild(codes(run, sets[0]));
      card.appendChild(el('p', {
        className: 'pass-clock',
        textContent: t('staffChanges', { time: P.clockOf(P.hourStart(hour + 1)) })
      }));

      card.appendChild(el('div', { className: 'staff-also' }, [
        el('p', { className: 'eyebrow', textContent: t('staffAlso') }),
        codes(run, sets[1])
      ]));

      card.appendChild(el('p', { className: 'pass-terms', textContent: t(run ? 'staffRollNote' : 'staffNote') }));

      /* Redraw a moment after the hour turns, rather than polling. A tablet
         left on this page all evening keeps up on its own. */
      if (timer) clearTimeout(timer);
      timer = setTimeout(function () { draw(data, deal, t); }, P.untilNextHour() + 1000);
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

    if (!deal) {
      P.clear(card);
      card.appendChild(el('p', { className: 'pass-lede', textContent: t('passNone') }));
      /* Landing here with no place at all is the likeliest way in, so say
         what the address is missing rather than only that nothing was found. */
      if (!placeId) {
        card.appendChild(el('p', { className: 'pass-terms', textContent: t('staffPick') }));
      }
      return;
    }

    draw(data, deal, t);
  }).catch(function () {
    card.textContent = 'Something went wrong loading the data. Try refreshing the page.';
  });
}());
