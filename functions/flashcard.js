/**
 * Tallinn Tastebuds — /flashcard, and the root of flashcard.tallinntastebuds.ee.
 *
 * flashcard.html again, with a head of its own and the deck written into it as
 * text. Three things that buys, and the third is the reason this file exists:
 *
 *   the tab says      "At the table"   and not "Flashcards | Tallinn Tastebuds"
 *   the page draws    the same as it always did — this is an improvement on
 *                     the load and never a requirement for it
 *   a search finds    the Estonian
 *
 * THE PAGE IS HIDDEN AND THE WORDS ARE NOT, WHICH IS NOT A CONTRADICTION
 *
 * Nothing on this site links to the flashcards except one row on
 * /account.html, behind a sign-in. That is deliberate — see **Flashcards** in
 * README.md — and it is the blog's arrangement rather than the split page's:
 * unlinked and indexed, not unlinked and hidden. The page shipped with a
 * noindex for a day, on the reasoning that a deck somebody wrote is theirs
 * alone. That is still true and this does not touch it: what is indexed is the
 * ten decks in data/decks.json, which are a file anybody may read, and a deck
 * out of the database needs a session that no crawler has and is served with a
 * noindex — see indexable below.
 *
 * Somebody searching for what "Kas see laud on vaba?" means should find this
 * site answering, and until this file existed the answer was a page with an
 * empty <main> and a script a crawler may or may not run.
 *
 * WHAT GOES IN, AND WHERE
 *
 * The head: head() out of ../_shell.js, unchanged and uncopied — unlike the map
 * and the split page, which write their twelve tags out because a restaurant
 * has a photograph and a group's name wants no site suffix after it. A deck
 * wants exactly what head() spells: "At the table | Tallinn Tastebuds", the
 * mark as its picture, and the site's name beside it.
 *
 * The text: the deck as a list of pairs, into the <main> the page ships empty
 * — fill() in ../_shell.js and EMPTY there, which holds the spelling. The
 * script empties it again before it draws, so nobody sees what went in.
 *
 * WHAT HAPPENS WHEN IT CANNOT
 *
 * The untouched page, and assets/flashcard.js asks /api/flashcard as it would
 * have anyway. A missing data file, a malformed one, a deck id that is nobody's
 * — all of them are the plain shell with the page's own head. Nothing here is
 * load-bearing for a reader who runs scripts, which is nearly all of them.
 */

import { canonical, esc, head, shell, rehead, fill, EMPTY, page, SITE } from './_shell.js';
import { dataFile } from './api/_lib.js';

const PATH = '/flashcard';
const FILE = '/flashcard.html';
const DECKS_FILE = '/data/decks.json';

/* English, on a site read in ten languages, for the reason spelled out at
   length in functions/list/[id].js: a crawler's Accept-Language is whatever
   its operator set, and the card built from these tags is shown to everybody
   a link is forwarded to rather than to whoever fetched it. It is a shorter
   argument here than there — the cards themselves are English and Estonian
   and nothing else, so there is no tenth translation of this page to prefer. */
const TITLE = 'Estonian flashcards';
const DESCRIPTION =
  'Ten decks of everyday Estonian — greetings, numbers, the words at the table, ' +
  'getting around Tallinn — with the Estonian on one side and the English on the other.';

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
   it. A list of links, so a crawler that landed on this page walks to the ten
   under it rather than treating it as a leaf. */
function deckList(decks) {
  const row = (deck) =>
    '<li><h2><a href="' + PATH + '?d=' + esc(deck.id) + '">' + esc(deck.name) + '</a></h2>' +
    (deck.why ? '<p>' + esc(deck.why) + '</p>' : '') +
    '</li>';
  return '<h1>' + esc(TITLE) + '</h1><p>' + esc(DESCRIPTION) + '</p>' +
    '<ol>' + decks.map(row).join('') + '</ol>';
}

/* And one deck, as the pairs it is: a description list, which is the element
   for exactly this and says the relationship between the two sides without a
   word of explanation. The Estonian is the term and the English is what it
   means, which is the direction the cards are turned in.

   A word that has its three forms carries all three in the term, and that is
   worth more here than it is on the card: somebody typing "leiba" into a
   search engine is looking at a menu, and the nominative they would have to
   know to find this page is the one thing they have not got. */
function deckWords(deck) {
  const forms = (card) => Array.isArray(card.forms) && card.forms.length === 2
    ? ' (' + esc(card.forms[0]) + ', ' + esc(card.forms[1]) + ')'
    : '';
  const pair = (card) =>
    '<dt>' + esc(card.front) + forms(card) + '</dt><dd>' + esc(card.back) + '</dd>';
  return '<h1>' + esc(deck.name) + '</h1>' +
    (deck.why ? '<p>' + esc(deck.why) + '</p>' : '') +
    '<dl>' + deck.cards.map(pair).join('') + '</dl>' +
    '<p><a href="' + PATH + '">' + esc(TITLE) + '</a></p>';
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
        title: deck.name,
        description: (deck.why ? deck.why + '. ' : '') +
          deck.cards.length + ' Estonian words and phrases, with what each one means in English.',
        /* The deck's own address rather than the page's, because a deck is a
           page of its own — the same call the map makes for ?spot=, and the
           same set of addresses tools/sitemap.mjs writes out. */
        url: where(request, PATH + '?d=' + deck.id),
        type: 'article'
      })
    : head({
        title: TITLE,
        description: DESCRIPTION,
        url: where(request, PATH),
        type: 'website'
      });

  const words = deck ? deckWords(deck) : own ? '' : deckList(decks);

  return page(fill(rehead(html, tags), EMPTY[FILE.slice(1)], words), 200, !own);
}
