/**
 * Tallinn Tastebuds — /flashcard, and the root of flashcard.tallinntastebuds.ee.
 *
 * flashcard.html again, with a head of its own and the deck written into it as
 * text. Four things that buys, and the last is the reason this file exists:
 *
 *   the tab says      "At the table"   and not "Flashcards | Tallinn Tastebuds"
 *   a link unfurls    as a card with a card on it, in the language it was sent
 *                     in — and not as the mouth over a line about restaurants
 *   the page draws    the same as it always did — this is an improvement on
 *                     the load and never a requirement for it
 *   a search finds    the Estonian — as words on the page, and as a glossary
 *                     in JSON-LD beside them, which is the half an assistant's
 *                     crawler would rather read
 *
 * THE PAGE IS HIDDEN AND THE WORDS ARE NOT, WHICH IS NOT A CONTRADICTION
 *
 * Nothing on this site links to the flashcards except one pill on the map's
 * rail. That is deliberate — see **How it is found** under **Flashcards** in
 * README.md — and it is the blog's arrangement rather than the split page's:
 * unlinked and indexed, not unlinked and hidden. The page shipped with a
 * noindex for a day, on the reasoning that a deck somebody wrote is theirs
 * alone. That is still true and this does not touch it: what is indexed is the
 * decks in data/decks.json, which are a file anybody may read, and a deck
 * out of the database needs a session that no crawler has and is served with a
 * noindex — see indexable below.
 *
 * Somebody searching for what "Kas see laud on vaba?" means should find this
 * site answering, and until this file existed the answer was a page with an
 * empty <main> and a script a crawler may or may not run.
 *
 * WHAT GOES IN, AND WHERE
 *
 * The head: head() out of ../_shell.js, uncopied — unlike the map and the split
 * page, which write their twelve tags out because a restaurant has a photograph
 * and a group's name wants no site suffix after it. A deck wants what head()
 * spells — "At the table | Tallinn Tastebuds", and the site's name beside it —
 * with one thing of its own, which is the picture. The mouth over "All the
 * places in this map I have personally been and approved" is the site's card
 * and the wrong card for a page about Estonian, so this route names one of its
 * own: CARD below. head() takes it as an argument, rather than this file
 * writing all twelve tags out to change one of them.
 *
 * And the words in those tags are in the language the link carried, which is
 * the one thing here that is not also true of the <main> under them:
 * languageOf() below is the whole of that argument.
 *
 * The text: the deck as the word and what it means in each of the three
 * languages the cards are written in, into the <main> the page ships empty
 * — fill() in ../_shell.js and EMPTY there, which holds the spelling. The
 * script empties it again before it draws, so nobody sees what went in.
 *
 * The data: the same deck again as schema.org's glossary — a DefinedTermSet of
 * DefinedTerms, the Estonian as the term and the three glosses each tagged
 * with its language — so that a reader which would rather be told than parse
 * is told. structuredData() below is the whole of it, and is on every address
 * that is indexed and no address that is not.
 *
 * WHAT HAPPENS WHEN IT CANNOT
 *
 * The untouched page, and assets/flashcard.js asks /api/flashcard as it would
 * have anyway. A missing data file, a malformed one, a deck id that is nobody's
 * — all of them are the plain shell with the page's own head, and a
 * data/ui.json that cannot be read is the head in English rather than no head
 * at all. Nothing here is load-bearing for a reader who runs scripts, which is
 * nearly all of them.
 */

import { canonical, esc, head, seed, shell, rehead, fill, EMPTY, page, SITE } from './_shell.js';
import { dataFile, uiStrings, DECK_LANGS } from './api/_lib.js';

const PATH = '/flashcard';
const FILE = '/flashcard.html';
const DECKS_FILE = '/data/decks.json';

/* The first of the three DECK_LANGS names and the site's own, which makes it
   what everything here falls back to: a language nobody asked for, a language
   this page does not speak, and a deck that was never written in the one that
   was asked for. */
const DEFAULT_LANG = 'en';

/* A deck's name, the line under it or a card's back — each of them an object
   keyed by language in data/decks.json — in the language asked for, and in
   English when it was not written in that one. English is the fallback rather
   than the empty string because it is the one tools/validate.mjs insists every
   card has. */
function inLanguage(pack, lang) {
  return (pack && (pack[lang] || pack[DEFAULT_LANG])) || '';
}

/* And the English on its own, which is what goes into the <main> whatever
   language the link was carrying. The block above TITLE says why. */
function inEnglish(pack) {
  return inLanguage(pack, DEFAULT_LANG);
}

/* What the page calls itself and says about itself in English, which is two
   things at once: the heading and the paragraph the <main> below is led by,
   and what the head falls back to when data/ui.json cannot be read.
 *
 * The <main> stays English whatever the link asked for, and that is the
 * argument functions/list/[id].js makes at length: a crawler's Accept-Language
 * is whatever its operator set, and what is written into the page as text is
 * for the reader that runs no script — which is a crawler, and which is asking
 * for the page rather than for a language. The words in the head are the other
 * case entirely and follow the link; the block above onRequest() says why. */
const TITLE = 'Estonian flashcards';
const DESCRIPTION =
  'Forty-two decks of Estonian, from the first twenty words to a jacket with a ' +
  'broken zip — the word, its three forms and a sentence to say it in.';

/* The card an unfurler draws, which is this page's own and not the site's.
 *
 * Every other route here hands head() the default — the watercolour mouth over
 * "All the places in this map I have personally been and approved" — and every
 * other route is right to: they are all views of the map. This one is not, and
 * a link to the flashcards pasted into a chat arrived as a picture of a mouth
 * under a sentence about restaurants, which is a card for the wrong site. The
 * head of assets/logo/og-flashcard.html says what is on this one instead.
 *
 * The picture is in English whatever language the words beside it are in, the
 * same way og.jpg is on a map shared with ?lang=et: it is a rendered file and
 * not a template, tools/ogcard.mjs draws it, and three of them would be three
 * pictures to redraw every time a token moves. */
const CARD = '/assets/logo/og-flashcard.png';

/* A deck id as data/decks.json spells one. Anything else is either somebody's
   own deck, whose sixteen hex characters mean nothing without their session,
   or nothing at all; both get the page's own head and a noindex. */
const WRITTEN = /^[a-z0-9][a-z0-9-]{0,31}$/;

/* Which address a deck says it is, and it is never the subdomain's own.
 *
 * This page answers at three: /flashcard on the live domain, the bare root of
 * flashcard.tallinntastebuds.ee, and /flashcard on every preview. The first
 * two are one page on two hostnames, which is precisely the split the
 * pages.dev redirect in functions/_middleware.js exists to stop — a search
 * engine picking one and half the links pointing at the other. Splitwise never
 * had to answer this because nothing on it is indexed at all.
 *
 * So the subdomain names the live domain's spelling rather than its own, and a
 * preview goes on naming itself, which is what canonical() is for and why it
 * is still called for everything that is not this one hostname. The address
 * people are given stays the short one either way; this is only about which of
 * the two a crawler is told to keep. */
const FLASH_HOST = 'flashcard.' + new URL(SITE).hostname;

function where(request, path) {
  return new URL(request.url).hostname === FLASH_HOST ? SITE + path : canonical(request, path);
}

async function decksOf(context) {
  try {
    const file = await dataFile(context, DECKS_FILE);
    return file && Array.isArray(file.decks) ? file.decks : [];
  } catch (e) {
    return [];
  }
}

/* The decks, as text: what each one is called and the line saying what is in
   it. A list of links, so a crawler that landed on this page walks to the
   forty-two under it rather than treating it as a leaf. */
function deckList(decks) {
  const row = (deck) =>
    '<li><h2><a href="' + PATH + '?d=' + esc(deck.id) + '">' + esc(inEnglish(deck.name)) + '</a></h2>' +
    (deck.why ? '<p>' + esc(inEnglish(deck.why)) + '</p>' : '') +
    '</li>';
  return '<h1>' + esc(TITLE) + '</h1><p>' + esc(DESCRIPTION) + '</p>' +
    '<ol>' + decks.map(row).join('') + '</ol>';
}

/* And one deck, as the words and their meanings it is: a description list,
   which is the element for exactly this and says the relationship between the
   two sides without a word of explanation. The Estonian is the term and what it
   means is the definition, which is the direction the cards are turned in.

   One <dt> and up to three <dd>s, because that is what a card now is: the same
   word, what it means in English, in Azerbaijani and in Russian, each saying
   which language it is in. Somebody typing "что значит leib" is asking the
   thing this page answers, and until the decks had a Russian side the answer
   here was in a language they may not read either.

   The sentence goes once, under the English, rather than three times: what
   anybody looks a word up with is the word, and the Estonian of the sentence is
   already on the page beside it.

   A word that has its three forms carries all three in the term, and that is
   worth more here than it is on the card: somebody typing "leiba" into a
   search engine is looking at a menu, and the nominative they would have to
   know to find this page is the one thing they have not got. */
function deckWords(deck) {
  const forms = (card) => Array.isArray(card.forms) && card.forms.length === 2
    ? ' (' + esc(card.forms[0]) + ', ' + esc(card.forms[1]) + ')'
    : '';
  /* And the example, where there is one. It is the most searchable thing on
     the page: a whole Estonian sentence with its English under it is what
     somebody is actually holding when they look one up. */
  const said = (card) => card.sentence && card.sentence.et && card.sentence.en
    ? '<p>' + esc(card.sentence.et) + ' — ' + esc(card.sentence.en) + '</p>'
    : '';
  const gloss = (card, lang) => card.back && card.back[lang]
    ? '<dd lang="' + lang + '">' + esc(card.back[lang]) + (lang === 'en' ? said(card) : '') + '</dd>'
    : '';
  const term = (card) =>
    '<dt>' + esc(card.front) + forms(card) + '</dt>' +
    DECK_LANGS.map((lang) => gloss(card, lang)).join('');
  return '<h1>' + esc(inEnglish(deck.name)) + '</h1>' +
    (deck.why ? '<p>' + esc(inEnglish(deck.why)) + '</p>' : '') +
    '<dl>' + deck.cards.map(term).join('') + '</dl>' +
    '<p><a href="' + PATH + '">' + esc(TITLE) + '</a></p>';
}

/* What a deck says about itself: the line under its name, and how many cards
 * are in it.
 *
 * The sentence this used to carry — that every card means something in
 * English, Azerbaijani and Russian — has gone to where it was always worth
 * more, which is the <dl> deckWords() builds: a crawler reads the three
 * glosses themselves there, each with a lang= on it, rather than a claim about
 * them in one language. What is left is what somebody forwarded the link is
 * actually asking, which is what this deck is and how long it takes. */
function deckSays(deck, languages, lang) {
  const ui = languages[lang] || {};
  const why = inLanguage(deck.why, lang);
  const many = (ui.flashCards || '{n} cards').replace('{n}', deck.cards.length);
  return (why ? why + ' — ' : '') + many + '.';
}

/* ------------------------------------------------------- what it is, in JSON
 *
 * The <dl> above is the deck as prose, for a reader that runs no script. This
 * is the same deck as data, for a reader that would rather be told than parse:
 * Google and Bing read it to work out what kind of page this is without
 * guessing from the markup, and the assistants' crawlers lean on it harder
 * still, because a description list is a shape and "this is a set of defined
 * terms in Estonian, and here are their glosses in three languages" is a
 * sentence.
 *
 * DefinedTermSet and DefinedTerm are schema.org's glossary, which is what a
 * deck of flashcards is once you take the turning-over away — the term is the
 * Estonian, the definition is what it means, and the set is the deck it was
 * filed in. Nothing here claims a rich result: there is no card-shaped snippet
 * to win, and a Course or a Quiz would each be a claim about this page that is
 * not quite true. What it buys is a crawler that knows the language of every
 * string on the page without sniffing it, and that is exactly the question
 * "что значит leib" turns on.
 *
 * It costs thirteen kilobytes on the shelf, which is forty-two names and their
 * lines, and between ten and thirty-four on a deck, which is one line per card
 * — a third of what the same block costs the map at its worst and a good deal
 * less on an ordinary deck, because a card is four short strings and a
 * restaurant is an address, a coordinate, a photograph and a write-up. See
 * **Getting found** in README.md for the map's half of that arithmetic.
 *
 * The English is what goes in the names and the descriptions of the page
 * itself, for the reason the <main> is English: this block is read by the
 * reader that runs no script, which is asking for the page rather than for a
 * language. The glosses are the exception and carry all three, each tagged
 * with the language it is in — the JSON-LD spelling of the lang= on a <dd>.
 */
const LANGUAGE = { '@type': 'Language', name: 'Estonian', alternateName: 'et' };

/* What the page is, said the same way whether it is the shelf or one deck: a
   page, and a thing to learn from. `teaches` is the one property here that a
   reader could not have worked out from the words on the page. */
function learningPage(self, name, description) {
  return {
    '@type': ['WebPage', 'LearningResource'],
    '@id': self + '#page',
    url: self,
    name,
    description,
    inLanguage: DEFAULT_LANG,
    isPartOf: { '@id': SITE + '#website' },
    isAccessibleForFree: true,
    learningResourceType: 'Flashcards',
    educationalLevel: 'Beginner',
    teaches: 'Estonian vocabulary',
    about: LANGUAGE
  };
}

/* One card. The three glosses are an array of language-tagged values, which is
   plain JSON-LD and is the only way to say that these three strings are the
   same description in three languages rather than three descriptions.

   `alternateName` is the principal parts, and it is doing real work: the form
   printed on a menu is the partitive far more often than it is the nominative,
   so "leiba" is what somebody types and "Leib" is what this deck files it
   under. The <dt> above puts the same three in the term for the same reason. */
function definedTerm(card, set) {
  const glosses = DECK_LANGS
    .filter((lang) => card.back && card.back[lang])
    .map((lang) => ({ '@value': card.back[lang], '@language': lang }));

  return {
    '@type': 'DefinedTerm',
    name: card.front,
    inLanguage: 'et',
    termCode: card.id,
    ...(Array.isArray(card.forms) && card.forms.length === 2
      ? { alternateName: card.forms }
      : {}),
    ...(glosses.length ? { description: glosses } : {}),
    inDefinedTermSet: { '@id': set }
  };
}

/* The graph: the site, the page, and then either the deck with its words in it
   or the shelf as a list of the decks on it. One deck is named in the shelf's
   list by its name and its line and never by its cards — a crawler that wants
   those follows the link, which is the same bargain the <ol> above strikes. */
function structuredData(request, decks, deck) {
  const site = { '@type': 'WebSite', '@id': SITE + '#website', url: SITE, name: 'Tallinn Tastebuds' };

  if (deck) {
    const self = where(request, PATH + '?d=' + deck.id);
    const set = self + '#deck';
    const name = inEnglish(deck.name);

    return {
      '@context': 'https://schema.org',
      '@graph': [
        site,
        { ...learningPage(self, name, inEnglish(deck.why) || DESCRIPTION), mainEntity: { '@id': set } },
        {
          '@type': 'DefinedTermSet',
          '@id': set,
          url: self,
          name,
          ...(deck.why ? { description: inEnglish(deck.why) } : {}),
          inLanguage: 'et',
          hasDefinedTerm: deck.cards.map((card) => definedTerm(card, set))
        },
        {
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: TITLE, item: where(request, PATH) },
            { '@type': 'ListItem', position: 2, name }
          ]
        }
      ]
    };
  }

  const self = where(request, PATH);

  return {
    '@context': 'https://schema.org',
    '@graph': [
      site,
      learningPage(self, TITLE, DESCRIPTION),
      {
        '@type': 'ItemList',
        name: TITLE,
        numberOfItems: decks.length,
        itemListOrder: 'https://schema.org/ItemListUnordered',
        itemListElement: decks.map((one, i) => {
          const at = where(request, PATH + '?d=' + one.id);
          return {
            '@type': 'ListItem',
            position: i + 1,
            item: {
              '@type': 'DefinedTermSet',
              '@id': at + '#deck',
              url: at,
              name: inEnglish(one.name),
              ...(one.why ? { description: inEnglish(one.why) } : {}),
              inLanguage: 'et'
            }
          };
        })
      }
    ]
  };
}

/* The language the head is written in, which is the one the link carried —
 * out of the three this feature speaks rather than the ten the site does.
 *
 * A link to this page is sent to somebody, the way a place's is and unlike a
 * list's: ?lang=az on it is the sender having chosen Azerbaijani for whoever
 * they are sending it to, and a card that came back in English would be the
 * site answering a question nobody asked. That is the arrangement **Sharing a
 * place** in README.md describes, applied here — and it is not the argument
 * the <main> is under, which has no reader to ask.
 *
 * It asks DECK_LANGS rather than data/ui.json's own keys, so the card a link
 * unfurls as is in a language the page behind it will actually be read in.
 * ?lang=fi used to buy a Finnish preview card over an English deck name and
 * an English page; now it buys English throughout, which is the same answer
 * said once instead of twice.
 *
 * ?lang= does not reach the canonical or og:url, and so this page has one
 * address in three languages rather than three addresses. What it costs is
 * Facebook, which treats og:url as the identity of the thing shared and will
 * therefore keep one card for all three; WhatsApp, Telegram, Slack, Signal and
 * X all read the tags of the address they were handed and show the language
 * the link was sent in. The other way round is three entries in
 * tools/sitemap.mjs, an hreflang set and three pages for a page nothing links
 * to, and that is the bargain the map struck for a reason this page does
 * not have. */
function languageOf(request, languages) {
  const asked = new URL(request.url).searchParams.get('lang');
  const speaks = asked &&
    DECK_LANGS.includes(asked) &&
    Object.prototype.hasOwnProperty.call(languages, asked);
  return speaks ? asked : DEFAULT_LANG;
}

export async function onRequest(context) {
  const { request } = context;

  let html;
  try {
    html = await shell(context, FILE);
  } catch (e) {
    return new Response('Not found', { status: 404 });
  }

  const asked = new URL(request.url).searchParams.get('d') || '';
  const decks = await decksOf(context);
  const deck = WRITTEN.test(asked)
    ? decks.find((d) => d && d.id === asked && Array.isArray(d.cards)) || null
    : null;

  /* The site's own words, for the head. A missing or malformed file is the
     English constants above rather than a page without a head — this route
     improves a load and is never a requirement for one. */
  let languages;
  try {
    languages = await uiStrings(context);
  } catch (e) {
    languages = {};
  }
  const lang = languageOf(request, languages);
  const ui = languages[lang] || {};

  /* An id that answers with nothing is somebody's own deck — sixteen hex
     characters that mean anything only to their session — or an id that was
     never anything. Both get the page's own head, nothing written into the
     <main>, and a noindex: the words are behind a session no crawler has, so
     what one would file is a page of nothing under a title it was not given,
     and what an unfurled link should say about an address whose contents are
     not the sender's to share is the page rather than the deck. */
  const own = asked !== '' && deck === null;

  const tags = deck
    ? head({
        title: inLanguage(deck.name, lang),
        description: deckSays(deck, languages, lang),
        /* The deck's own address rather than the page's, because a deck is a
           page of its own — the same call the map makes for ?spot=, and the
           same set of addresses tools/sitemap.mjs writes out. */
        url: where(request, PATH + '?d=' + deck.id),
        type: 'article',
        image: CARD
      })
    : head({
        title: ui.flashDoor || TITLE,
        /* The line the page itself opens with, rather than a second sentence
           written for the head alone: what somebody forwarded this link wants
           to know is what the thing is and what they are meant to do with it,
           and flashWhat is already that, in all three. */
        description: ui.flashWhat || DESCRIPTION,
        url: where(request, PATH),
        type: 'website',
        image: CARD
      });

  const words = deck ? deckWords(deck) : own ? '' : deckList(decks);

  /* And the same thing as data, on everything that is indexed. A deck out of
     the database gets none: its words are behind a session, so what this would
     describe is the empty page the noindex above is for. */
  const said = own || (!deck && decks.length === 0)
    ? tags
    : tags + '\n<script type="application/ld+json">' +
      seed(structuredData(request, decks, deck)) + '</script>';

  return page(fill(rehead(html, said), EMPTY[FILE.slice(1)], words), 200, !own);
}
