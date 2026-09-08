/* Tallinn Tastebuds — reading a sentence as a wish, without a model.
 *
 * The chat box on the map takes a sentence — "somewhere cheap and asian, open
 * now" — and has to turn it into places. Most of the time a language model in
 * a Function does that (see functions/api/ask.js). This is what answers when
 * it does not: the daily allowance is spent, the binding is not configured,
 * the network is gone, or the model came back with something unusable.
 *
 * It is not a fallback in the apologetic sense. A hand-written reader over
 * seventy-five places is genuinely good at the questions people actually type,
 * because the vocabulary it needs is small and already written down. What it
 * cannot do is mood — "somewhere I can hear myself think" means nothing here —
 * and that is the whole of what the model buys.
 *
 * WHY A GLOBAL AND NOT A MODULE
 *
 * The same reason as assets/basemap.js, assets/pass.js and assets/radio.js:
 * no build step, no bundler, and a classic script setting one global needs
 * neither. Loaded before app.js, and both are `defer`, so document order is
 * execution order.
 *
 * IT TOUCHES NO DOM AND HOLDS NO STATE
 *
 * Two functions in and out of it, both pure. The panel, the cards and the map
 * are app.js's — it already draws all three — and this only ever answers the
 * question "which places, and why". That is what makes it readable in one
 * sitting and what lets app.js render an answer from the model and an answer
 * from here through exactly the same code.
 *
 * IT DOES NOT FOLD ITS OWN TEXT
 *
 * Accent folding — Šašlõkk to saslokk — already exists three times over, in
 * app.js, lists.js and venues.js. A fourth copy here is how a fifth gets
 * written, so the caller passes its own `fold` in and there is no copy. The
 * same goes for the haystack: app.js builds a folded index of every place on
 * boot and hands it over rather than having one built again.
 *
 * THE VOCABULARY IS IN data/ui.json, NOT IN HERE
 *
 * Three things a person asks for have no words in the data: cheap, fancy, and
 * open now. Everything else they might type — bakery, vegan, date, asian — is
 * already a taxonomy label in all ten languages, and app.js already indexes
 * those, so typing "pagariäri" or "пекарня" finds the bakeries for free.
 *
 * The three that are missing live in ui.json under askWordsCheap,
 * askWordsFancy and askWordsOpen, as synonyms joined by "|" — the same shape
 * `days` and `months` already use. That puts them where every other string on
 * this site lives, which means the validator holds them to all ten languages
 * like everything else, and adding a language is one file rather than two.
 */
window.TTBAsk = (function () {
  'use strict';

  /* A question longer than this is a paragraph, and a paragraph is somebody
     playing rather than asking. Cut rather than refused: the first part of a
     long question is usually still the question. */
  var MAX_QUESTION = 200;

  /* How many places an answer names. Three is the number a person reads; a
     list of ten is the map again, and they already had the map. */
  var MAX_PICKS = 3;

  /* Words that carry no wish in any of the ten languages — the joins and
     articles a sentence is made of. Left in, each would match a place whose
     name or street happens to contain those letters, and "a" matches nearly
     everything. Folded already, because that is how they are compared.

     This is deliberately not a stopword list per language, which would be
     hundreds of words and stale the day a language is added. It is the short
     list of things that measurably matched the wrong places while this was
     being written. */
  var NOISE = (
    'a an the and or of for in on at to me i im is are want would like some ' +
    'something somewhere place places good nice please can you find show ' +
    'ja voi vai see on ning kus midagi kohta koht hea palun ' +
    'и или на в где что нибудь место хорошее пожалуйста хочу'
  ).split(' ');

  function isNoise(word) {
    return word.length < 2 || NOISE.indexOf(word) !== -1;
  }

  /* The punctuation a typed sentence carries, spelled out rather than written
     as "not a letter". `\w` is ASCII in this dialect and unicode property
     escapes are two language versions past it, so either way of saying "not a
     letter" here would throw away Cyrillic and Armenian wholesale — which is
     three of the ten languages this box answers in. Listing what to remove
     cannot make that mistake: anything unlisted is kept. */
  var PUNCTUATION = /[.,!?;:()[\]{}"'`\/\\|~@#$%^&*_+=<>–—‘’“”«»¿¡-]+/g;

  /* One ui.json synonym list — "cheap|budget|not expensive" — as folded
     phrases, longest first.

     Longest first is the whole reason this sorts at all: "not expensive" and
     "expensive" are both in the table, on opposite sides, and a question
     containing the first contains the second. Testing the long one before the
     short one is what stops "not expensive" being read as a request for
     somewhere expensive. */
  function phrases(list, fold) {
    var out = [];
    String(list || '').split('|').forEach(function (word) {
      var folded = fold(word).replace(/\s+/g, ' ').replace(/^ | $/g, '');
      if (folded) out.push(folded);
    });
    out.sort(function (a, b) { return b.length - a.length; });
    return out;
  }

  /* Whether one phrase is in the question, on whole words.

     Both sides are padded with a space and the phrase is looked for with its
     own spaces around it, which is a word boundary that costs nothing and
     works in every alphabet — `\b` is ASCII in this dialect and would put a
     boundary in the middle of a Cyrillic word.

     The padding is not decoration. Without it the Portuguese label for coffee,
     "chá", folds to "cha" and matches "khaCHApuri", so asking for a Georgian
     cheese bread returned three cafés. Every short label in ten languages is
     that bug waiting: "tee", "cay", "pub", "date". */
  function has(question, phrase) {
    return (' ' + question + ' ').indexOf(' ' + phrase + ' ') !== -1;
  }

  /* Whether the question says any of them, and which. Phrases of two words
     are found as readily as one, which is why this is not a word-by-word
     pass over the question. */
  function said(question, list) {
    for (var i = 0; i < list.length; i++) {
      if (has(question, list[i])) return list[i];
    }
    return '';
  }

  /* Every way a label could be typed. A label is written for a chip on a
     filter row, and nobody types a chip:

       "Coffee/tea"       two words for one thing, and one of them is typed
       "Date night"       asked for as "a date", never as "a date night"
       "Vabas vormis/üksi" both halves, and either word of the first

     So the slash splits it, each half stands on its own, and each word of a
     half does too. A whole half is trusted down to three letters — "tea" is a
     real thing to ask for — but a single word pulled out of a longer label
     has to be four, because that is where the useful ones ("date", "eats",
     "night") sit and the ones that are only ever noise ("gem", "in", "в")
     fall below. */
  function ways(label, fold) {
    var out = [];

    String(label).split('/').forEach(function (half) {
      var whole = fold(half).replace(PUNCTUATION, ' ')
        .replace(/\s+/g, ' ').replace(/^ | $/g, '');
      if (whole.length > 2) out.push(whole);
      if (whole.indexOf(' ') === -1) return;
      whole.split(' ').forEach(function (word) {
        if (word.length > 3) out.push(word);
      });
    });

    return out;
  }

  /* Which taxonomy types a sentence names, in all ten languages at once —
     which is how "bakery", "pagariäri" and "пекарня" all reach `bakery`.

     app.js has typeWords() joining the same labels for its search index, and
     this is the opposite question rather than the same one: that builds one
     string per place out of the types the place has, this takes a sentence and
     asks which type ids are in it. Which is why the labels are wanted apart
     here, one at a time through ways() above, rather than joined into a line. */
  function typeSaid(question, types, fold) {
    var hit = [];

    types.forEach(function (type) {
      Object.keys(type).forEach(function (key) {
        if (key === 'id' || hit.indexOf(type.id) !== -1) return;
        var found = ways(type[key], fold).some(function (word) {
          return has(question, word);
        });
        if (found) hit.push(type.id);
      });
    });

    return hit;
  }

  /* ------------------------------------------------------------------ read
   * A sentence as the wish behind it.
   *
   *   opts.fold    the caller's accent folding, as above
   *   opts.types   data/taxonomy.json's types, whole, with all ten labels
   *   opts.words   { cheap, fancy, open } — the ui.json synonym lists
   *
   * Out comes what was asked for, and `rest`: the words left over once the
   * wishes and the noise are taken out. Those are what the place index is
   * searched with — a dish, a street, a name — and they are the reason
   * "khachapuri" works without khachapuri being a word anybody wrote down.
   */
  function read(question, opts) {
    var fold = opts.fold;
    var q = fold(String(question || '').slice(0, MAX_QUESTION))
      .replace(PUNCTUATION, ' ')
      .replace(/\s+/g, ' ')
      .replace(/^ | $/g, '');

    var cheap = phrases(opts.words.cheap, fold);
    var fancy = phrases(opts.words.fancy, fold);
    var open = phrases(opts.words.open, fold);

    /* Fancy before cheap, and it matters: "cheap" is a word in the English
       label "Cheap eats" and a phrase in the fancy list can contain it too.
       A question that says both is asking for the dearer thing — nobody
       writes "cheap fine dining" and means the cheap half. */
    var wantsFancy = said(q, fancy);
    var wantsCheap = wantsFancy ? '' : said(q, cheap);
    var wantsOpen = said(q, open);

    var types = typeSaid(q, opts.types, fold);

    /* What is left is a dish or a name. The wish phrases come out first so
       that "cheap" does not also go looking for a place called Cheap. */
    var spent = [].concat(
      wantsFancy ? [wantsFancy] : [],
      wantsCheap ? [wantsCheap] : [],
      wantsOpen ? [wantsOpen] : []
    );
    var left = q;
    spent.forEach(function (p) { left = left.split(p).join(' '); });

    var rest = left.split(' ').filter(function (word) {
      return word && !isNoise(word);
    });

    return {
      types: types,
      cheap: !!wantsCheap,
      fancy: !!wantsFancy,
      open: !!wantsOpen,
      rest: rest,
      /* Whether the sentence asked for anything this can act on at all. A
         question that reads as nothing — "hello", "what is this" — should be
         answered with a shrug rather than with three places chosen by a
         scoring pass that had nothing to score. */
      empty: !types.length && !wantsCheap && !wantsFancy && !wantsOpen && !rest.length
    };
  }

  /* ------------------------------------------------------------------ rank
   * The wish against the places, best first.
   *
   *   opts.hay     place id -> the folded haystack app.js already built
   *   opts.open    place id -> "22:00" for somewhere open now, or absent
   *   opts.saves   place id -> how many people saved it, for the tie-break
   *
   * Every place starts at nothing and earns its way up, and a place that
   * earns nothing is not in the answer. Nothing here subtracts: a wish a
   * place does not answer simply does not pay it, which is what keeps a
   * question with four things in it from ruling out everywhere in the city.
   *
   * `why` on a hit is not a record of everything that scored — it is the two
   * things a row cannot say for itself, the closing time and the word that
   * matched. Everything else a place earned its place with is already printed
   * on the row that gets drawn.
   */
  function rank(places, wish, opts) {
    var open = opts.open || {};
    var hay = opts.hay || {};
    var scored = [];

    places.forEach(function (place) {
      /* Somewhere shut for good is never an answer to "where should I go".
         It stays on the map, because every link ever shared still lands on
         it, but it is not somewhere to be sent tonight. */
      if (place.closed) return;

      var score = 0;
      var why = [];
      var mine = place.types || [];

      /* A type is the strongest thing a question can say, because it is the
         one the map itself is organised by. It scores and says nothing: the
         row that gets drawn already prints its own types, so a line under it
         naming them again is the row explaining itself with itself. Same for
         the price below, which the row draws as a gauge. See askLocally() in
         assets/app.js, where the two things worth saying are turned into the
         sentence under a row. */
      wish.types.forEach(function (id) {
        if (mine.indexOf(id) !== -1) score += 4;
      });

      /* Price, as the map counts it: 1 and 2 are cheap, 3 and 4 are not.
         The half-steps in the data — 2.5 — round the way the question would
         read them, which is down for cheap and up for fancy. */
      if (wish.cheap && place.price && place.price <= 2) score += 3;
      if (wish.fancy && place.price && place.price >= 3) score += 3;

      /* Open now is a fact rather than an opinion, and it comes from Google's
         week through the Function. Without the Function there is no `open`
         map at all, and the wish quietly stops paying — an answer that is
         silent about hours is honest, one that guesses is not. */
      if (wish.open && open[place.id]) {
        score += 3;
        why.push({ key: 'askWhyOpen', until: open[place.id] });
      }

      /* Whatever is left of the sentence, against the name, the street, the
         type labels and the dishes. One point a word, so a question naming
         two of them beats one naming either. */
      var straw = hay[place.id] || '';
      wish.rest.forEach(function (word) {
        if (straw.indexOf(word) === -1) return;
        score += 1;
        why.push({ key: 'askWhyWord', word: word });
      });

      if (score > 0) scored.push({ place: place, score: score, why: why });
    });

    /* Score first, and the tie broken by how many people have saved the place
       — which is the only measure of quality this site keeps, and the honest
       thing to fall back on when the question cannot choose between two.
       Places with no saves at all keep the alphabet they arrived in, because
       a stable order means the same question twice gives the same answer. */
    var saves = opts.saves || {};
    scored.sort(function (a, b) {
      if (b.score !== a.score) return b.score - a.score;
      return (saves[b.place.id] || 0) - (saves[a.place.id] || 0);
    });

    return scored.slice(0, MAX_PICKS);
  }

  return { read: read, rank: rank, MAX_QUESTION: MAX_QUESTION };
})();
