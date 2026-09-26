/* Tallinn Tastebuds — reading a sentence as a wish, for the model to narrow on.
 *
 * The chat box on the map takes a sentence — "somewhere cheap and asian, open
 * now" — and a language model in a Function turns it into places (see
 * functions/api/ask.js). Before it does, the Function narrows the seventy
 * places and the eleven hundred Google rows to the ones the sentence could
 * be about, and this is what tells it what the sentence is about: which
 * types, whether cheap or fancy, whether open now, what it wants to be near,
 * and the words left over that might be a dish or a street.
 *
 * It used to be a second half of the chat as well — a ranker that drew rows
 * in the panel at once and again whenever the model was away. That is gone.
 * A substring matcher choosing three places for "not sure", with nothing
 * under them saying why, and then the model's rows replacing them, was the
 * chat bringing something whether or not it had a clue and then changing its
 * mind. Now the model is the only thing that ever names a place, and this
 * only reads.
 *
 * The find bar across the top of the map reads with it too — see WHAT THE
 * BAR UNDERSTANDS in the find section of app.js. It is the same question
 * asked of a shorter sentence: which kinds, which cuisines, near whom, how
 * dear, and what is left over. There the leftovers are matched in the
 * browser rather than sent anywhere, and "open now" is read and not
 * answered, because nothing the bar holds knows a week of hours.
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
 * Two functions in and out of it, both pure: read() takes a sentence, and
 * carry() takes the wish the conversation had and the wish this sentence
 * adds. The panel, the cards and the map are app.js's, and this only ever
 * answers "what is this conversation asking for" — never "which places".
 * That is what keeps it readable in one sitting.
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
 * Five things a person asks for have no words in the data: cheap, fancy,
 * open now, near somewhere, and themselves — "near me", "around here".
 * Everything else they might type — bakery, vegan, date, asian — is already
 * a taxonomy label in all ten languages, and app.js already indexes those,
 * so typing "pagariäri" or "пекарня" finds the bakeries for free.
 *
 * The five that are missing live in ui.json under askWordsCheap,
 * askWordsFancy, askWordsOpen, askWordsNear and askWordsMe, as synonyms
 * joined by "|" — the same shape `days` and `months` already use. That puts
 * them where every other string on this site lives, which means the
 * validator holds them to all ten languages like everything else, and adding
 * a language is one file rather than two.
 */
window.TTBAsk = (function () {
  'use strict';

  /* A question longer than this is a paragraph, and a paragraph is somebody
     playing rather than asking. Cut rather than refused: the first part of a
     long question is usually still the question. */
  var MAX_QUESTION = 200;

  /* Words that carry no wish in any of the ten languages — the joins and
     articles a sentence is made of. Left in, each would match a place whose
     name or street happens to contain those letters, and "a" matches nearly
     everything. Folded already, because that is how they are compared.

     This is deliberately not a stopword list per language, which would be
     hundreds of words and stale the day a language is added. It is the short
     list of things that measurably matched the wrong places while this was
     being written — and, on the third line of each language, the filler a
     chat sentence carries once the wish is out of it: "more", "options",
     "else", "recommend". Those did worse than match a place. "More vegan
     options nearby" says near and nothing after it, so what is left over
     from the whole sentence is taken as the place to be near, and "more
     options" went to Photon, which placed it somewhere and measured every
     distance from there. With the filler out, nothing is left, and the
     question is about the visitor, which is what it was. The fourth line
     is the glue of a follow-up — "the second one", "instead", "actually"
     — which carry() below has to read as nothing to eat, so that they
     keep the conversation's topic rather than replace it. */
  var NOISE = (
    'a an the and or of for in on at to me i im is are want would like some ' +
    'something somewhere place places good nice please can you find show ' +
    'how does do it this that what which why who there here ' +
    'more other another else any few couple options option spots spot ideas ' +
    'idea suggestions suggestion recommend recommendation recommendations tell give ' +
    'best top ' +
    'one first second third next last latest instead rather actually maybe also ' +
    'again then just really ' +
    'ja voi vai see on ning kus midagi kohta koht hea palun kuidas mis kas kuhu ' +
    'veel muud muid teisi moni moned paar valikuid valikud soovita soovitusi ' +
    'parim parimad parimat ' +
    'esimene teine kolmas jargmine viimane hoopis pigem tegelikult vist jalle siis lihtsalt ' +
    'и или на в где что нибудь место хорошее пожалуйста хочу как это куда ' +
    'еще другие другое другои другую несколько пару варианты вариант вариантов ' +
    'посоветуи посоветуите подскажи подскажите лучшии лучшие лучшая лучшее самыи самое ' +
    'первыи первая второи вторая третии последнии следующии вместо лучше вообще ' +
    'может тоже опять снова тогда просто'
  ).split(' ');

  /* Two letters is not a word anybody asks for a place by, in any of the
     ten languages, and it is a substring of half the map: "it" is in Piti
     and in Vesta, and "how does it work" was answered with three
     restaurants before this said so. */
  function isNoise(word) {
    return word.length < 3 || NOISE.indexOf(word) !== -1;
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
     somewhere expensive — which only holds when both sides are in the one
     list being tested, see the price pass in read(). */
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
  function typeSaid(question, types, fold, saidWith) {
    var hit = [];

    types.forEach(function (type) {
      Object.keys(type).forEach(function (key) {
        if (key === 'id' || hit.indexOf(type.id) !== -1) return;
        var found = ways(type[key], fold).some(function (word) {
          if (!has(question, word)) return false;
          /* The label as it was typed, kept for the caller: what names a
             kind of place is not the name of somewhere to be near. */
          if (saidWith && saidWith.indexOf(word) === -1) saidWith.push(word);
          return true;
        });
        if (found) hit.push(type.id);
      });
    });

    return hit;
  }

  /* ------------------------------------------------------------------ read
   * A sentence as the wish behind it.
   *
   *   opts.fold      the caller's accent folding, as above
   *   opts.types     data/taxonomy.json's types, whole, with all ten labels
   *   opts.cuisines  data/cuisines.json's cuisines, the same shape — what a
   *                  Google row can be asked for by, since the export files a
   *                  place as Thai or Georgian and my taxonomy does not
   *   opts.words     { cheap, fancy, open, near, me } — the ui.json synonym
   *                  lists
   *
   * Out comes what was asked for, and `rest`: the words left over once the
   * wishes and the noise are taken out. The Function matches those against
   * each place's name, street, types and dishes when it narrows — a dish, a
   * street, a name — and they are the reason "khachapuri" works without
   * khachapuri being a word anybody wrote down. `nearby` is whether they
   * asked to be near anything at all, and `near` is what: the words that
   * name it, which the Function turns into a point and measures from, or
   * nothing when the thing to be near is the visitor — "near me", "siin
   * lähedal" — and the point is the one their device gives.
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
    var near = phrases(opts.words.near, fold);
    var me = phrases(opts.words.me, fold);

    /* Both price lists in one pass, longest phrase first, and the list the
       winning phrase belongs to decides. The two were read one list at a
       time, fancy first, and that is how "not expensive" and "less
       expensive" came back as requests for somewhere expensive: "expensive"
       is in the fancy list, and the longer phrase around it sat unread in
       the other one. Read together, "not expensive" outranks the
       "expensive" inside it; "cheap fine dining" is "fine dining" before it
       is "cheap", which is right — nobody writes that and means the cheap
       half; and a plain "cheap" against a plain "fancy" goes to fancy,
       because the fancy phrases are first in the join and the sort keeps
       the order of equals. */
    var priced = said(q, phrases(opts.words.fancy + '|' + opts.words.cheap, fold));
    var wantsFancy = priced && fancy.indexOf(priced) !== -1 ? priced : '';
    var wantsCheap = priced && !wantsFancy ? priced : '';
    var wantsOpen = said(q, open);
    var wantsNear = said(q, near);

    /* The labels as typed are kept too — "coffee", "fine dining", "thai" —
       for one use below: a kind of place is not a landmark. */
    var kinds = [];
    var types = typeSaid(q, opts.types, fold, kinds);
    /* The same reading over the directory's vocabulary: "thai", "tai" and
       "тайская" all reach `thai`. The export's rows carry these ids, and so
       do the sixty of my places that have a Google row — the Function lends
       each its row's cuisine — so the one word scores both rolls. */
    var kitchens = typeSaid(q, opts.cuisines || [], fold, kinds);

    /* What is left is a dish or a name. The wish phrases come out first so
       that "cheap" does not also go looking for a place called Cheap — and
       every phrase the sentence contains comes out, not only the one that
       decided each wish. One per wish left "late" behind in "is the second
       one open late": "open" had settled the wish, "late" read as the
       subject, and a follow-up about the kebab place became a question
       about somewhere called Late that replaced the thread's topic. Longest
       first for the same reason the price lists are read that way: "not
       expensive" has to go before the "expensive" inside it. */
    var spent = [];
    [fancy, cheap, open, near].forEach(function (list) {
      list.forEach(function (p) { if (has(q, p)) spent.push(p); });
    });
    spent.sort(function (a, b) { return b.length - a.length; });
    var clean = function (text) {
      var left = text;
      spent.forEach(function (p) { left = left.split(p).join(' '); });
      return left.split(' ').filter(function (word) {
        return word && !isNoise(word);
      });
    };

    var rest = clean(q);

    /* What they want to be close to: the words after the near phrase, with
       the other wishes and the noise out — "something close to my place,
       laulupeo street" is asking about laulupeo street, and "cheap ramen
       near laulupeo" about laulupeo, not about ramen. Said the other way
       round, "laulupeo street, somewhere near" — which is also the only way
       round Estonian, Finnish or Turkish say it, "bussijaama lähedal" —
       nothing follows the phrase and what is left over is taken instead.
       The street stays in `rest` too, so a place actually on it still
       scores as a word.

       Two things never name a place to be near. The visitor — "near me",
       "close to my hotel", "minu lähedal", "siin lähedal kohvi" — is
       themselves, wherever in the sentence they say so, and the point for
       that is the one their device gives: the answer is nothing, and
       nothing else is looked for. "Ramen near me" used to strip "me" as
       noise, find nothing after the phrase, and fall through to the
       leftovers, which handed "ramen" to the geocoder. And a kind of place
       is not a landmark: "coffee close to me" fell through the same way and
       handed it "coffee", which found a café called Coffee somewhere in
       town and measured every distance from it. The labels typeSaid()
       matched come out, so what is left is a street, a district or a name,
       or nothing. A dish left over — "ramen nearby" — still gets looked up,
       because nothing here can tell a dish from a street, and the chat
       prints what it measured from for exactly that reason. */
    var at = '';
    if (wantsNear && !said(q, me)) {
      var whole = ' ' + q + ' ';
      kinds.forEach(function (p) { whole = whole.split(' ' + p + ' ').join(' '); });
      var after = whole.split(' ' + wantsNear + ' ').slice(1).join(' ');
      at = (clean(after).length ? clean(after) : clean(whole)).join(' ');
    }

    return {
      types: types,
      kitchens: kitchens,
      cheap: !!wantsCheap,
      fancy: !!wantsFancy,
      open: !!wantsOpen,
      nearby: !!wantsNear,
      near: at,
      rest: rest
    };
  }

  /* ----------------------------------------------------------------- carry
   * The wish as the conversation has it: what this sentence said, over what
   * the sentences before it said.
   *
   * A follow-up rarely repeats the question. "Coffee near the bus station"
   * and then "something cheaper" — the second sentence names no kind and no
   * place, and read on its own it is a wish for nothing: narrowed to the
   * floor, a cross-section of the map with the cafés mostly gone and the
   * station forgotten, the distances back to the visitor's own dot, handed
   * to a model that was just asked for a cheaper café by the station. The
   * model was reminded of the thread; the narrowing was not.
   *
   * So the wish has a topic and three constraints, and each is the newest
   * sentence that said anything about it. The topic is what to eat — the
   * kind of place read off the labels, and the words left over, which is
   * where a dish or a name lands — and a sentence that names any of it is
   * a new question about that: "thai" replaces "coffee", and so does
   * "khachapuri", because a carried "coffee" would hold that answer to
   * cafés — the Function holds picks to the kind asked for — and a person
   * who types a dish after a café has changed the subject, not added to
   * it. A sentence that names nothing to eat — "something cheaper", "the
   * second one", "near me instead" — keeps the topic. The constraints are
   * the price, open now, and near, each carried whole until restated:
   * "fancy" replaces "cheap", "near Kalamaja" replaces "near me". "Open"
   * cannot be taken back, since nothing in read() can hear "not
   * necessarily open"; it is the one thing that only accumulates.
   *
   * The seam is the leftover words, so what counts as one matters more
   * here than it did: "the second one", "instead", "actually" are noise
   * above precisely so that they read as nothing to eat and keep the topic
   * rather than replace it with a search for a place called Instead.
   *
   *   earlier   the wish the previous question was asked with, or null for
   *             the first question of a conversation
   *   now       read() over this sentence
   *
   * The thread goes when the chat is closed, and what was carried goes with
   * it: the next conversation starts from its own first sentence.
   */
  function carry(earlier, now) {
    if (!earlier) return now;
    var topic = now.types.length || now.kitchens.length || now.rest.length;
    var price = now.cheap || now.fancy;
    return {
      types: topic ? now.types : earlier.types,
      kitchens: topic ? now.kitchens : earlier.kitchens,
      rest: topic ? now.rest : earlier.rest,
      cheap: price ? now.cheap : earlier.cheap,
      fancy: price ? now.fancy : earlier.fancy,
      open: now.open || earlier.open,
      nearby: now.nearby || earlier.nearby,
      near: now.nearby ? now.near : earlier.near
    };
  }

  return { read: read, carry: carry, MAX_QUESTION: MAX_QUESTION };
})();
