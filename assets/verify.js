/* verify.html — the answer a waiter gets.
 *
 * Reached by scanning a guest's QR with the plain camera app: no install, no
 * account, no training beyond "point it at the square". The whole page is one
 * word and one colour, because it is read across a counter in about half a
 * second, and everything under that word is for the cases where the answer is
 * no and somebody has to work out why.
 */
(function () {
  'use strict';

  var P = window.TTBPass;
  var el = P.el;

  var card = document.getElementById('card');
  var params = new URLSearchParams(window.location.search);
  var placeId = params.get('r') || '';
  var hour = params.get('h') || '';
  var claimed = params.get('c') || '';

  /* Every answer the check can give: the word, the colour band it sits on,
     and the line underneath explaining what to do about it. */
  var ANSWERS = {
    ok:        { word: 'verifyOk',       tone: 'is-ok',   note: 'verifyOkNote' },
    expired:   { word: 'verifyExpired',  tone: 'is-warn', note: 'verifyExpiredNote' },
    early:     { word: 'verifyNo',       tone: 'is-warn', note: 'verifyEarlyNote' },
    mismatch:  { word: 'verifyNo',       tone: 'is-no',   note: 'verifyMismatchNote' },
    unknown:   { word: 'verifyNo',       tone: 'is-no',   note: 'verifyUnknownNote' },
    malformed: { word: 'verifyNo',       tone: 'is-no',   note: 'verifyMalformedNote' },
    notyet:    { word: 'verifyNotYet',   tone: 'is-warn', note: 'verifyNotYetNote' },
    ended:     { word: 'verifyEnded',    tone: 'is-warn', note: 'verifyEndedNote' },
    error:     { word: 'verifyNo',       tone: 'is-warn', note: 'verifyErrorNote' }
  };

  var TICK = '<svg class="verdict-mark" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4 12.5l5.5 5.5L20 6.5"/></svg>';
  var CROSS = '<svg class="verdict-mark" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6 6l12 12M18 6L6 18"/></svg>';

  P.applyStyle();

  P.load().then(function (data) {
    var lang = P.pickLanguage(Object.keys(data.ui));
    var t = P.translator(data.ui, lang);
    document.documentElement.lang = lang;
    document.title = t('verifyTitle') + ' | Tallinn Tastebuds';

    return P.verify(data, placeId, hour, claimed).then(function (result) {
      var answer = ANSWERS[result.status] || ANSWERS.error;
      var ok = result.status === 'ok';

      P.clear(card);

      /* The verdict, and nothing beside it. Colour, word and mark all say the
         same thing, so no one of them has to be caught on its own. */
      card.appendChild(el('div', { className: 'verdict ' + answer.tone, role: 'status' }, [
        el('span', { html: ok ? TICK : CROSS }),
        el('span', { className: 'verdict-word', textContent: t(answer.word) }),
        el('span', { className: 'verdict-note', textContent: t(answer.note) })
      ]));

      /* A deal still in the drawer verifies perfectly well, and would look
         exactly like a live one without this. */
      if (result.deal && !result.deal.live) {
        card.appendChild(el('p', { className: 'pass-flag', textContent: t('verifyTest') }));
      }

      if (result.place) {
        card.appendChild(el('div', { className: 'pass-head' }, [
          el('p', { className: 'eyebrow', textContent: t('passOffer') }),
          el('h1', { className: 'pass-name', textContent: result.place.name })
        ]));
      }

      /* What to actually give them. Only worth printing when the answer was
         yes — under a red banner it reads like an instruction. */
      if (ok && result.deal) {
        var offer = P.textFor(result.deal.offer, lang);
        if (offer) card.appendChild(el('p', { className: 'pass-lede', textContent: offer }));

        var terms = P.textFor(result.deal.terms, lang);
        if (terms) card.appendChild(el('p', { className: 'pass-terms', textContent: terms }));

        card.appendChild(el('p', {
          className: 'pass-clock',
          textContent: t('verifyMade', { time: P.clockOf(P.hourStart(Number(hour))) })
        }));
      }
    });
  }).catch(function () {
    P.clear(card);
    card.appendChild(el('div', { className: 'verdict is-warn' }, [
      el('span', { html: CROSS }),
      el('span', { className: 'verdict-word', textContent: 'Error' }),
      el('span', {
        className: 'verdict-note',
        textContent: 'The code could not be checked. Reload the page and try again.'
      })
    ]));
  });
}());
