/**
 * Tallinn Tastebuds — flashcards, and the Estonian on them.
 *
 * A site about eating in Tallinn is read mostly by people who cannot read the
 * menu. This is the other half of that: forty-two decks of Estonian, one
 * thousand nine hundred and sixty cards, Estonian on the front and what it
 * means on the back, and a person turning them over one at a time. It lives
 * on its own subdomain — flashcard.tallinntastebuds.ee, routed by
 * functions/_middleware.js — for the reason splitwise does: it is not the map,
 * and a sixth card on the account page reading "Flashcards" would have been a
 * second product filed under somebody's saved places.
 *
 * WHERE THE WORDS ACTUALLY ARE, WHICH IS MOSTLY NOT HERE
 *
 * The decks this site ships are data/decks.json, deployed as a file and read
 * as one through dataFile() below. They are content: somebody edits the
 * repository, the deploy carries them, and every reader gets the same one
 * thousand nine hundred and sixty cards. Nothing about them is in the
 * database and nothing needs to be — a row per card per deployment would be a copy of a file
 * that only a deploy changes, and the first thing anybody would have to write
 * is the tool that keeps the two in step.
 *
 * What the tables hold is the three things a file cannot: the decks people
 * write for themselves, how far each person has got, and which of the shipped
 * cards readers say is wrong. See **Flashcards** in README.md and the block at
 * the end of db/schema.sql.
 *
 * **Nothing here chooses which language a card is turned over into.** A deck
 * the site ships carries its name, the line under it and the back of every
 * card as an object keyed by language — English, Azerbaijani and Russian — and
 * this file hands that object on whole. Which one a reader sees is means() in
 * assets/flashcard.js, per card, against the language the page is being read
 * in — and that language is the one thing this file does settle, in the
 * section below, because the list it is settled against lives on this side. A
 * deck somebody wrote carries one string per side, in whatever language they
 * typed, and there is nothing to choose between.
 *
 * THE WORDS ON THE PAGE COME WITH THE DECKS
 *
 * Every other page on this site fetches data/ui.json whole on the way in: ten
 * languages of every string the site has, 85 KB gzipped, to print eighty of
 * them in one language. That was the biggest thing between opening this page
 * and seeing a card, and the least of it was used. So the GET below carries
 * the page's words in its answer — the one language block the page will print
 * from, eight to ten KB gzipped, in the same request that brings the decks —
 * and the page fetches nothing else.
 *
 * Which language is decided here rather than on the page, because the list
 * of languages this feature has is on this side: the page sends what it would
 * have picked from, in order (?lang=, then the choice stored on the map, then
 * the browser's own languages), and wordsFor() in ./_lib.js takes the first
 * that list speaks. It is the same rule pickLanguage() applies on every other
 * page, moved to where the list is, and it lives in _lib.js rather than here
 * because /api/stats answers the same way for the same reason. The whole block
 * goes rather than the eighty keys, because a list of keys here would be a
 * second copy of what assets/flashcard.js asks for, and the validator could
 * not see them drift.
 *
 * AND THE LIST IS THREE LANGUAGES LONG, NOT TEN
 *
 * Every call to wordsFor() from this file passes DECK_LANGS — English,
 * Azerbaijani and Russian, the three data/decks.json writes the back of a card
 * in. The site speaks ten and this feature speaks three, and the header of
 * DECK_LANGS in ./_lib.js is the argument: the back of a flashcard is the
 * lesson rather than the chrome around it, so a Finnish door over an English
 * answer is a promise the cards cannot keep. ?lang=fi is therefore English
 * here and Finnish everywhere else on the site, which is the one place this
 * page deliberately disagrees with the rest of it.
 *
 * And the three codes go in the answer, because the page has a switch on it
 * and the switch has to be able to name them: `langs` is those three, sorted
 * by code the way the map sorts its own menu, each with the name that language
 * has for itself. Three short pairs, well under a hundred bytes against the
 * eight to ten KB already in the answer — and the page can draw the menu out
 * of the same one request it draws the cards from. Picking one then asks this
 * route again for that block alone.
 *
 * IT IS THE SAME ACCOUNT AS THE MAP
 *
 * No second users table, no second password, no second sign-in route — the
 * same argument functions/api/split.js makes at more length. An owner is a
 * users.id out of ./account.js, and one line in sessionCookie() in ./_lib.js
 * scopes the session cookie to the domain rather than the host, so signing in
 * on the map is being signed in here. That line arrived for splitwise and
 * this feature is its second reader, which is worth knowing before either of
 * them is taken out.
 *
 * SIGNED OUT, THE DECKS STILL WORK
 *
 * Everything the site ships is readable with no account at all: the decks and
 * every card in them are a file, and a file has nobody to check. What an
 * account buys is that pressing "Knew it" is remembered — on the account, not
 * on the device, so the deck you got half through on a phone is half through
 * on a laptop. Signed out, the page keeps the run in the tab and offers an
 * account at the end of it. That is the same shape the map's saves have and
 * the same sentence they are offered with.
 *
 * Which is why the two marking actions below arrive in a burst on the load
 * after somebody signs in: the page holds what it answered signed out and
 * posts it once there is a session — keep() in assets/flashcard.js. Nothing
 * here treats them differently, and nothing needs to. They are the same two
 * actions with the same checks, sent a few dozen at a time instead of one at
 * a time, and a card that is already in a box simply moves up from it.
 *
 * WHAT THIS FILE IS ALLOWED TO DO
 *
 * The rules ./lists.js is written to, because the argument is the same: D1
 * has no public endpoint, so the attack surface of these three tables is
 * exactly this file.
 *
 *   - Every query is a prepared statement with bound parameters. Nothing from
 *     a request is ever concatenated into SQL.
 *   - **A deck somebody wrote has exactly one reader, and it is its owner.**
 *     There is no sharing here and no link that buys anything — unlike a list
 *     or a splitwise group, where holding the code is the permission. Every
 *     read of a deck out of the database goes through deckOf(), which takes
 *     the session's own id, and a deck belonging to somebody else answers the
 *     way a deck that does not exist answers.
 *   - **Every write takes a session but one**, including the two that only say
 *     a card was known. The exception is `report`, which says a shipped card
 *     is wrong: the decks turn over signed out and most of the people reading
 *     them are, so an account in front of that is a mistake that never gets
 *     reported. It is filed under a hashed network fingerprint rather than
 *     under a person — see flashcard_reports in db/schema.sql — which is what
 *     makes it the one write here that needs SAVE_SALT.
 *   - A card marked known is checked against the deck it claims to be in —
 *     the file for a built-in deck, the table for somebody's own — so the
 *     progress table cannot be filled with rows about cards that do not
 *     exist.
 *   - Everything anybody types is capped in length before it is stored, and
 *     the counts below cap how much of it there can be.
 *
 * NOTHING HERE IS CACHED. The decks list carries the reader's own progress in
 * it, and json() without a maxAge is no-store — a session-gated answer behind
 * a public max-age is the one mistake ./_lib.js names in its own header.
 */

import {
  json, sessionUser, wrongDatabase, randomHex, dataFile, wordsFor, fingerprint, clientIp,
  DECK_LANGS
} from './_lib.js';
import { googleReady } from './_google.js';

/* The decks the site ships, as deployed. */
const DECKS_FILE = '/data/decks.json';

/* Caps, and all of them are about somebody with a script rather than somebody
   learning a language.
 *
 * MAX_CARDS is the one worth arguing about. Two hundred is several times the
 * longest deck this site ships, and well past what anybody turns over in a
 * sitting; past it the thing being asked for is a vocabulary manager and not a
 * deck of cards. */
const MAX_DECKS = 20;
const MAX_CARDS = 200;
const MAX_NAME = 60;
/* Both sides of a card. Sixty characters is a short sentence — "Kas ma saan
   maksta kaardiga?" is thirty-one — and the card draws it at a size somebody
   reads across a table. A paragraph on a flashcard is a note, and notes want
   a different feature. */
const MAX_SIDE = 60;

/* How many cards one network fingerprint may report in an hour. Twenty is far
   more than anybody turning cards over finds wrong in a sitting and far less
   than a script would want: the point is that a table nobody reads but me
   cannot be filled faster than I can read it. The same fingerprint the saves
   and the feedback are capped by, and the same shape of cap. */
const REPORTS_PER_HOUR = 20;
const HOUR = 3600000;

/* Not a cap on anybody, but on a statement: D1 binds at most a hundred
   parameters to one, so a read that names its rows names ninety-nine of them
   and keeps the hundredth for the owner. Only gathered() below needs it, and
   only because MAX_CARDS is twice this. */
const PER_READ = 99;

/* ------------------------------------------------------------- the spacing
 * How long a card waits before it is asked again, by the box it is in: one
 * day, three, a week, a fortnight, five weeks, eleven. Six rungs, and a card
 * that reaches the last one stays there, which is a little over four months
 * between askings — past that the thing being remembered is not the word, it
 * is the site.
 *
 * Leitner's scheme rather than SM-2, deliberately. SM-2 wants a grade out of
 * five and keeps an ease factor per card, and this page asks one question with
 * two answers: a scheduler cannot be cleverer than what it is told. Getting a
 * card wrong does not move it down a box either — it goes to box nought, due
 * now, so the card is back in the next run from the beginning and in the deck
 * of what you got wrong. MISSED below is that box.
 *
 * Days rather than a time of day, and the clock is the reader's own: a card
 * answered at eleven at night is due at eleven the next night rather than at
 * midnight in Tallinn. Nobody doing this in the evening should find their
 * deck empty because the day turned over in a city they are not in.
 */
const DAY = 86400000;
const BOXES = [1 * DAY, 3 * DAY, 7 * DAY, 14 * DAY, 35 * DAY, 77 * DAY];
const MAX_BOX = BOXES.length;

/* And box nought, which is not a rung: it is the card you pressed Show me
 * again on. The row stays rather than being deleted, so that the one thing
 * somebody wants after a run — "show me the ones I got wrong" — is a fact in
 * the table rather than something they have to remember.
 *
 * It is a box and not a column of its own because every read of this table
 * already reads the box, and a second column would be a second thing every
 * query had to say something about. Nought is below the first rung and above
 * nothing at all, which is exactly what a missed card is.
 */
const MISSED = 0;

/* The deck that is not a deck: every card, from every deck, that is sitting
   in box nought. It is assembled per request out of rows this person owns —
   there is no row in flashcard_decks for it and there never will be — and its
   id is reserved, so tools/validate.mjs refuses a shipped deck that claims
   the name. */
const MISSED_DECK = 'missed';

/* ---------------------------------------------------------- the stages
 * The three levels the decks page groups its rows under are stages now, and
 * the second and third open on how many words this person knows: a hundred
 * for Getting by, four hundred for Going deeper. First words is always open.
 *
 * What is counted is what is *known* — every shipped card in a box above
 * nought, which is the same count the row's "9 / 22" is drawn from — rather
 * than what has been seen. That is WaniKani's rule and not Duolingo's: the
 * next level there opens when enough of the last one has reached a stage of
 * the spacing, and here that stage is the first rung, because this page
 * asks one question and has one answer to count. A deck somebody wrote does
 * not count, whichever box its cards are in — a hundred words typed and
 * pressed Knew it on would open every stage — and neither does the deck of
 * what you got wrong, since box nought is by definition not known.
 *
 * The numbers are here rather than in data/decks.json or on the page because
 * a threshold is a rule about the count and the count is computed here; the
 * page prints whatever this answer carries, so there is one copy to move.
 * README.md, **Which decks are open** under **Flashcards**, is why a hundred
 * and four hundred.
 */
const GATES = { more: 100, deep: 400 };

/* And the other one: every card, from every deck, that this person has got
   right at least once — box one and up — with the ones whose wait has come
   round put first. It is the spacing's own queue, "what to look at again
   today", gathered out of the same rows in the same way, and its id is
   reserved for the same reason. */
const REVIEW_DECK = 'review';

/* Sixteen hex characters: a deck's id, and a card's. Minted rather than
   slugged, because neither ever appears in a link anybody sends — see
   flashcard_decks in db/schema.sql. */
const MINTED = /^[0-9a-f]{16}$/;

/* A built-in deck's id and a built-in card's, as data/decks.json spells them:
   lowercase words. tools/validate.mjs holds the file to this and to not
   looking like a minted id, so the two namespaces cannot meet. */
const WRITTEN = /^[a-z0-9][a-z0-9-]{0,31}$/;

function mintedId() {
  return randomHex(8);
}

/* Trim, cap, and flatten the newlines somebody's phone keyboard put in, so no
   field here can be stored longer than the card that draws it. The same three
   lines ./split.js keeps, kept here for the same reason it gives: a feature
   that is meant to be removable in an afternoon does not put a helper in a
   shared file to be unpicked out of it later. */
function words(value, max) {
  return String(typeof value === 'string' ? value : '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

/* ------------------------------------------------------------ the shipped
 * data/decks.json, read through the five-minute per-isolate cache every other
 * data file on this site is read through. A malformed or missing file is an
 * empty list rather than a throw: the page then draws whatever the person's
 * own decks are and says nothing is shipped, which is a worse site but not a
 * broken one.
 */
/* An example, where a card has one: the Estonian, and what it means in each
   language the deck is written in. Held to the shape here rather than trusted,
   because it is drawn as two lines and a half-written one would be a card with a
   stray sentence on it. The two asked for are the two the page cannot do
   without — the Estonian, and the English every other language falls back to;
   the rest ride along beside them. */
function isSentence(value) {
  return !!value && typeof value.et === 'string' && value.et !== '' &&
    typeof value.en === 'string' && value.en !== '';
}

async function shipped(context) {
  try {
    const file = await dataFile(context, DECKS_FILE);
    const decks = file && Array.isArray(file.decks) ? file.decks : [];
    return decks.filter((d) => d && WRITTEN.test(String(d.id || '')) && Array.isArray(d.cards));
  } catch (e) {
    return [];
  }
}

function shippedDeck(decks, id) {
  return decks.find((d) => d.id === id) || null;
}

/* ------------------------------------------------------------- somebody's
 * Both halves of "a deck you wrote": the row, and only ever your own. There
 * is no second lookup that takes an id without an owner, which is what makes
 * the ownership rule a property of this file rather than of each caller.
 */
async function deckOf(env, id, user) {
  if (!user || !MINTED.test(String(id || ''))) return null;
  return env.DB
    .prepare('SELECT id, name, created_at FROM flashcard_decks WHERE id = ? AND owner = ?')
    .bind(id, user.id)
    .first();
}

async function cardsOf(env, deckId) {
  const { results } = await env.DB
    .prepare('SELECT id, front, back FROM flashcard_cards WHERE deck_id = ? ORDER BY created_at LIMIT ?')
    .bind(deckId, MAX_CARDS)
    .all();
  return results || [];
}

/* --------------------------------------------- the two columns, or without
 * `box` and `due_at` were added to flashcard_known after it had been deployed
 * and filled, and nothing in CI applies a schema — so there is always an
 * afternoon where the code knows about them and the database does not.
 *
 * This is readingPins() in ./_pins.js, which solves the same problem for the
 * column a list's marker lives in: try the query that wants them, and on the
 * one error that means they are missing, remember that for the life of the
 * isolate and run the other one instead. Without them every known card reads
 * as due, which is what this page did before there was any spacing at all.
 */
let spaced = null;

async function readingBoxes(env, make) {
  if (spaced === false) return make(false);
  try {
    const out = await make(true);
    spaced = true;
    return out;
  } catch (e) {
    if (!/no such column/i.test(String((e && e.message) || e))) throw e;
    spaced = false;
    return make(false);
  }
}

/* Every card this person has said they know, and whether it is due to be
   asked again: a Map of "<deck>/<card>" to true for due, false for resting.
   One indexed read over their own rows, rather than a query per deck — an
   account that has been through everything this site ships holds eight hundred
   rows, which is smaller than the answer the page is about to draw anyway. */
async function knownOf(env, user) {
  if (!user) return new Map();
  const now = Date.now();
  const { results } = await readingBoxes(env, (boxes) =>
    env.DB
      .prepare(boxes
        ? 'SELECT deck_id, card_id, box, due_at FROM flashcard_known WHERE user_id = ?'
        : 'SELECT deck_id, card_id, 1 AS box, 0 AS due_at FROM flashcard_known WHERE user_id = ?')
      .bind(user.id)
      .all());
  const out = new Map();
  for (const row of results || []) {
    out.set(row.deck_id + '/' + row.card_id, {
      /* Known is a rung, not a row: a card in box nought is one somebody has
         seen and got wrong, which is the opposite of knowing it. */
      known: row.box > MISSED,
      missed: row.box === MISSED,
      due: row.due_at <= now,
      /* When it came due, kept so the review deck can put the card that has
         waited longest first. Nothing else reads it. */
      at: row.due_at
    });
  }
  return out;
}

/* How many of the shipped cards this person knows, across every deck: the
   number the stages open on. Summed over the decks in the file rather than
   over the Map, so that a card in a deck somebody wrote — which has its own
   minted id and is in the same table — is never in it. */
function wordsKnown(decks, known) {
  let words = 0;
  for (const deck of decks) {
    for (const card of deck.cards) if (stateOf(known, deck.id, card.id).known) words += 1;
  }
  return words;
}

/* What one card's row says, for callers that do not want to think about a
   card that has no row at all. Never answered is not known, not missed, and
   due — which is how an unseen card has always behaved. */
const NEW_CARD = { known: false, missed: false, due: true };

function stateOf(known, deckId, cardId) {
  return known.get(deckId + '/' + cardId) || NEW_CARD;
}

/* One deck as the page reads it, whichever kind of deck it is: one of the
   site's own out of data/decks.json, or one somebody wrote out of the two
   tables. Three callers were building this object by hand and had already
   begun to differ over `why`, which only a shipped deck has — so it is built
   in one place and the differences are the arguments.

   `known` is the Map out of knownOf(), keyed "<deck>/<card>", which is the
   same key the table is keyed on, and answering whether that card is due.

   Two booleans per card and they are not the same question. `known` is
   whether this person has ever got it right, which is what the count on the
   deck's row is made of. `due` is whether it is in today's run: a card nobody
   has ever answered is due because it has never been asked, and a card
   answered right is not due again until its box says so. */
function deckAnswer(deck, cards, own, known) {
  return {
    id: deck.id,
    name: deck.name,
    why: own ? null : (deck.why || null),
    /* Which stage a shipped deck is in, so that a deck opened by its address
       can be held to that stage's gate the way its row is. A deck of your own
       and the two gathered decks are in none and are never held. */
    level: own ? null : (deck.level || null),
    own: own,
    cards: cards.map((c) => {
      const was = stateOf(known, c.deck || deck.id, c.id);
      return {
        /* A card in the missed deck says which deck it is really from, so
           that answering it there writes to the row it came from rather than
           minting a second one under a deck that does not exist. */
        deck: c.deck || deck.id,
        id: c.id,
        front: c.front,
        back: c.back,
        forms: Array.isArray(c.forms) && c.forms.length ? c.forms : null,
        sentence: isSentence(c.sentence) ? c.sentence : null,
        known: was.known,
        due: was.due
      };
    })
  };
}

/* ------------------------------------------------ the two gathered decks
 * Every card, from every deck, that is sitting in box nought, as one deck —
 * and every card that has been got right at least once, as another. Each is
 * the thing people actually want after a run: show me the ones I got wrong,
 * and show me what I have learnt, when it is time. They are queries rather
 * than tables: the rows are already there, and a second table holding the
 * same cards under a different name is two places for a card to be.
 *
 * The cards come back from two places, because the rows do. A shipped deck's
 * card is in data/decks.json, already in hand. One of somebody's own is a row
 * in flashcard_cards, and is fetched by id — capped, like everything here, so
 * an account that has pressed Show me again five hundred times gets the first
 * two hundred rather than a query that grows without a ceiling. The review
 * deck is the one where the cap can bite for an ordinary reader — eight
 * hundred known cards is somebody who has been through everything the site
 * ships — which is why the due ones are put in front of the rest before the
 * cut: what is waiting is never the part that gets left out.
 *
 * Each card keeps the id of the deck it is really from, so that answering it
 * here writes to that row. Nothing is ever written under either id.
 */
async function gathered(context, user, decks, id, want) {
  const { env } = context;
  if (!want.length) return null;

  const cards = [];
  const mine = [];
  for (const one of want.slice(0, MAX_CARDS)) {
    const deck = shippedDeck(decks, one.deck);
    const card = deck && deck.cards.find((c) => c.id === one.card);
    if (card) cards.push({ ...card, deck: one.deck });
    else if (MINTED.test(one.deck) && MINTED.test(one.card)) mine.push(one);
  }

  /* Only over decks this person owns — the join is what keeps a card id
     somebody guessed from answering.
   *
     In runs of PER_READ, because this was one read for all of them and D1
     refuses a statement with more than a hundred parameters bound to it. The
     ceiling here is MAX_CARDS, which is two hundred, so somebody who had
     pressed Show me again on a hundred cards of their own decks got an error
     where the deck should have been — and the deck it broke is the one that
     fills up when things are going badly, which is exactly when nobody wants
     to be told to come back later. */
  for (let at = 0; at < mine.length; at += PER_READ) {
    const ids = mine.slice(at, at + PER_READ).map((one) => one.card);
    const { results } = await env.DB
      .prepare('SELECT c.id AS id, c.deck_id AS deck, c.front AS front, c.back AS back ' +
               'FROM flashcard_cards c JOIN flashcard_decks d ON d.id = c.deck_id ' +
               'WHERE d.owner = ? AND c.id IN (' + ids.map(() => '?').join(',') + ')')
      .bind(user.id, ...ids)
      .all();
    for (const row of results || []) cards.push(row);
  }

  return { id: id, name: null, why: null, cards: cards };
}

/* The rows of a person's, as the "<deck>/<card>" keys knownOf() files them
   under, split back into the two ids. */
function keyed(key) {
  const cut = key.indexOf('/');
  return { deck: key.slice(0, cut), card: key.slice(cut + 1) };
}

function missedDeck(context, user, decks, known) {
  const want = [];
  known.forEach((was, key) => { if (was.missed) want.push(keyed(key)); });
  return gathered(context, user, decks, MISSED_DECK, want);
}

/* Due first, and among the due the one that has waited longest first — a card
   a fortnight overdue is nearer to being forgotten than one due this morning,
   and it is the spacing's whole point that it is asked before it goes. The
   rest follow in the order the rows came, and the page leaves them out of a
   run until they come round: they are there so that Go through it anyway has
   the whole of what somebody knows to go through. */
function reviewDeck(context, user, decks, known) {
  const due = [];
  const rest = [];
  known.forEach((was, key) => {
    if (!was.known) return;
    (was.due ? due : rest).push({ ...keyed(key), at: was.at });
  });
  due.sort((a, b) => a.at - b.at);
  return gathered(context, user, decks, REVIEW_DECK, due.concat(rest));
}

/* ---------------------------------------------------------------- reading */

export async function onRequestGet(context) {
  const { request, env } = context;

  /* The decks the site ships come out of a file, so they are drawn whatever
     the database is doing. `ready` is about the other two things this page
     can do — remembering where you got to, and the decks you wrote yourself —
     and the page says one quiet line where it is false rather than refusing
     to draw. That is the difference between this page and splitwise's, which
     has nothing to show at all without a database. */
  const ready = !!env.DB && !(await wrongDatabase(env));
  const google = googleReady(env);
  const decks = await shipped(context);

  const user = ready ? await sessionUser(request, env) : null;
  const who = user ? user.username : null;
  const params = new URL(request.url).searchParams;
  const asked = params.get('deck') || '';

  const known = await knownOf(env, user);

  /* What every answer below carries, whichever deck it is about: the three
     facts about this deployment and this session, the words the page will
     print them with, and what the stages open on — how many words this person
     knows, and the two numbers that count is held against. Those go with
     every answer and not only the list, because a link to a deck in a stage
     that has not opened yet lands on that deck and the page has to be able to
     say so there. */
  const base = {
    ready: ready, google: google, user: who,
    words: wordsKnown(decks, known), gates: GATES,
    ...(await wordsFor(context, params.get('lang'), DECK_LANGS))
  };

  if (asked) {
    /* The two decks that are not decks. Only ever this person's own rows, so
       there is nothing here to own and nothing to check beyond having a
       session — and nothing to answer without one. */
    if (asked === MISSED_DECK || asked === REVIEW_DECK) {
      const which = asked === MISSED_DECK ? missedDeck : reviewDeck;
      const got = user ? await which(context, user, decks, known) : null;
      if (!got) return json({ ...base, error: 'not-found' }, 404);
      const answer = deckAnswer(got, got.cards, false, known);
      answer[asked] = true;
      return json({ ...base, deck: answer }, 200);
    }

    const mine = await deckOf(env, asked, user);
    if (mine) {
      const cards = await cardsOf(env, mine.id);
      return json({ ...base, deck: deckAnswer(mine, cards, true, known) }, 200);
    }

    const deck = shippedDeck(decks, asked);
    /* A deck id that is somebody else's, one that was deleted, and one that
       was never anything are the same answer. */
    if (!deck) return json({ ...base, error: 'not-found' }, 404);

    return json({ ...base, deck: deckAnswer(deck, deck.cards, false, known) }, 200);
  }

  /* How many of a deck this person knows, and how many of it are waiting for
     them now. The second is the one the row prints when it is not nought —
     "6 due" is a reason to open a deck and "9 / 22" is a fact about one.

     A card in box nought counts towards the second and not the first, and
     that is the whole of what box nought means: it is not known, and it is
     due. It used to be left out of both, which made the row disagree with the
     deck behind it — nine of twenty-two known and nothing said to be waiting,
     and then opening it ran the three cards that had been got wrong. The run
     was right. Getting a word wrong does not take it out of the deck it
     belongs to — see mark() below, and **The deck of what you got wrong** in
     README.md — so the row says so.

     It is waiting in the missed deck as well, and those are the same cards
     counted in two places on purpose. One place is the deck they came from
     and the other is every deck at once. */
  const counts = {};
  known.forEach((was, key) => {
    if (!was.known) return;
    const deck = key.slice(0, key.indexOf('/'));
    counts[deck] = (counts[deck] || 0) + 1;
  });
  const dueIn = (deck, cards) =>
    cards.filter((c) => stateOf(known, deck, c.id).due).length;

  const list = decks.map((d) => ({
    id: d.id,
    name: d.name,
    why: d.why || null,
    level: d.level || null,
    cards: d.cards.length,
    known: Math.min(counts[d.id] || 0, d.cards.length),
    due: dueIn(d.id, d.cards),
    own: false
  }));

  /* And the two that are assembled rather than stored, at the top where they
     belong: what somebody got wrong is the most useful thing on this page and
     the only part of it they did not choose, and what they have learnt is the
     thing the spacing exists to bring back. Each is left out entirely when it
     is empty — a row reading "0" would be a standing reminder of nothing.

     The review row counts every known card as its size and the ones whose
     wait has come round as due, so it reads "6 due" while there is something
     to do and "40 / 40" when there is not — the same two sentences every
     other row says, meaning the same things. */
  const rows = [...known.values()];
  const learnt = rows.filter((was) => was.known);
  if (learnt.length > 0) {
    list.unshift({
      id: REVIEW_DECK,
      name: null,
      why: null,
      level: null,
      cards: learnt.length,
      known: learnt.length,
      due: learnt.filter((was) => was.due).length,
      own: false,
      review: true
    });
  }
  const missed = rows.filter((was) => was.missed).length;
  if (missed > 0) {
    list.unshift({
      id: MISSED_DECK,
      name: null,
      why: null,
      level: null,
      cards: missed,
      known: 0,
      due: missed,
      own: false,
      missed: true
    });
  }

  if (user) {
    const { results } = await env.DB
      .prepare(
        'SELECT d.id AS id, d.name AS name, ' +
        '(SELECT COUNT(*) FROM flashcard_cards WHERE deck_id = d.id) AS cards ' +
        'FROM flashcard_decks d WHERE d.owner = ? ORDER BY d.updated_at DESC LIMIT ?'
      )
      .bind(user.id, MAX_DECKS)
      .all();
    /* A deck of your own needs its cards counted for the same two numbers,
       and they are not in the row above — the count there is a subquery. One
       read of this person's own cards, which is capped at MAX_DECKS ×
       MAX_CARDS and is the only query on this page that grows with what
       somebody has written. */
    const { results: ownCards } = await env.DB
      .prepare('SELECT c.id AS id, c.deck_id AS deck_id FROM flashcard_cards c ' +
               'JOIN flashcard_decks d ON d.id = c.deck_id WHERE d.owner = ?')
      .bind(user.id)
      .all();
    const byDeck = {};
    for (const row of ownCards || []) {
      (byDeck[row.deck_id] = byDeck[row.deck_id] || []).push({ id: row.id });
    }

    (results || []).forEach((row) => {
      list.push({
        id: row.id,
        name: row.name,
        why: null,
        cards: row.cards,
        level: null,
        known: Math.min(counts[row.id] || 0, row.cards),
        due: dueIn(row.id, byDeck[row.id] || []),
        own: true
      });
    });
  }

  return json({ ...base, decks: list }, 200);
}

/* ---------------------------------------------------------------- writing */

export async function onRequestPost(context) {
  const { request, env } = context;

  if (!env.DB) return json({ error: 'no-database' }, 503);
  /* A preview deployment holding the live database, or the reverse. A deck
     written while checking a change must not be a deck on the live site. */
  if (await wrongDatabase(env)) return json({ error: 'wrong-database' }, 503);

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return json({ error: 'malformed' }, 400);
  }

  const action = body.action;

  /* The one write here that asks for nobody, and it is above the session for
     that reason. Everything else on this page is about you — your decks, your
     progress — and this one is about the card: the decks turn over signed out,
     most of the people reading them are, and a mistake nobody can report
     without making an account is a mistake nobody reports. */
  if (action === 'report') return report(context, body);

  /* Every other write, the two that only say a card was known included. There
     is nothing else on this page filed under anything but an account. */
  const user = await sessionUser(request, env);
  if (!user) return json({ error: 'signed-out' }, 401);

  if (action === 'deck')   return newDeck(context, body, user);
  if (action === 'knew')   return mark(context, body, user, true);
  if (action === 'again')  return mark(context, body, user, false);
  /* Starting a deck again is about this person's own rows and not about the
     deck, so it is routed above the ownership check with the two above it: a
     built-in deck has no row to own and is the one most likely to be reset. */
  if (action === 'reset')  return reset(context, user, body.deck);

  /* Everything left names a deck of this person's own, and reading it is how
     the ownership rule is applied — once, here, rather than in each of the
     four below. */
  const deck = await deckOf(env, body.deck, user);
  if (!deck) return json({ error: 'not-found' }, 404);

  if (action === 'rename')   return rename(context, body, user, deck);
  if (action === 'drop')     return dropDeck(context, user, deck);
  if (action === 'card')     return addCard(context, body, user, deck);
  if (action === 'uncard')   return dropCard(context, body, user, deck);
  if (action === 'editcard') return editCard(context, body, user, deck);

  return json({ error: 'action' }, 400);
}

/* One of your own decks, whole, which is what every write that changes a deck
   comes back with — the page redraws from it rather than patching the row it
   just changed. */
async function ownDeckAnswer(env, deck, user) {
  const cards = await cardsOf(env, deck.id);
  /* The same read the page's own load does, rather than a second query shaped
     almost like it: one place in this file knows how that table is read, and
     it is knownOf(). */
  return deckAnswer(deck, cards, true, await knownOf(env, user));
}

async function heldDecks(env, user) {
  const row = await env.DB
    .prepare('SELECT COUNT(*) AS n FROM flashcard_decks WHERE owner = ?')
    .bind(user.id)
    .first();
  return row ? row.n : 0;
}

/* A deck starts as a name and nothing in it. The empty state is a real one
   and the page draws it: a deck with no cards is the form that adds the
   first, rather than a deck that refuses to open. */
async function newDeck(context, body, user) {
  const { env } = context;

  const name = words(body.name, MAX_NAME);
  if (!name) return json({ error: 'name' }, 400);
  if (await heldDecks(env, user) >= MAX_DECKS) return json({ error: 'too-many' }, 429);

  const now = Date.now();
  const deck = { id: mintedId(), name: name, created_at: now };
  await env.DB
    .prepare('INSERT INTO flashcard_decks (id, owner, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')
    .bind(deck.id, user.id, name, now, now)
    .run();

  return json({ deck: await ownDeckAnswer(env, deck, user) }, 200);
}

async function rename(context, body, user, deck) {
  const { env } = context;

  const name = words(body.name, MAX_NAME);
  if (!name) return json({ error: 'name' }, 400);

  await env.DB
    .prepare('UPDATE flashcard_decks SET name = ?, updated_at = ? WHERE id = ? AND owner = ?')
    .bind(name, Date.now(), deck.id, user.id)
    .run();

  deck.name = name;
  return json({ deck: await ownDeckAnswer(env, deck, user) }, 200);
}

/* And it takes everything in it, including what anybody had learnt off it.
   There is no archive and no undo: what this deletes is a list of words
   somebody typed, and keeping a copy of it against their wishes would be the
   site deciding it knew better. */
async function dropDeck(context, user, deck) {
  const { env } = context;

  await env.DB.batch([
    env.DB.prepare('DELETE FROM flashcard_known WHERE deck_id = ?').bind(deck.id),
    env.DB.prepare('DELETE FROM flashcard_cards WHERE deck_id = ?').bind(deck.id),
    env.DB.prepare('DELETE FROM flashcard_decks WHERE id = ? AND owner = ?').bind(deck.id, user.id)
  ]);

  return json({ dropped: deck.id }, 200);
}

async function addCard(context, body, user, deck) {
  const { env } = context;

  const front = words(body.front, MAX_SIDE);
  const back = words(body.back, MAX_SIDE);
  if (!front) return json({ error: 'front' }, 400);
  if (!back) return json({ error: 'back' }, 400);

  const row = await env.DB
    .prepare('SELECT COUNT(*) AS n FROM flashcard_cards WHERE deck_id = ?')
    .bind(deck.id)
    .first();
  if (row && row.n >= MAX_CARDS) return json({ error: 'full' }, 429);

  const now = Date.now();
  await env.DB.batch([
    env.DB
      .prepare('INSERT INTO flashcard_cards (id, deck_id, front, back, created_at) VALUES (?, ?, ?, ?, ?)')
      .bind(mintedId(), deck.id, front, back, now),
    env.DB.prepare('UPDATE flashcard_decks SET updated_at = ? WHERE id = ?').bind(now, deck.id)
  ]);

  return json({ deck: await ownDeckAnswer(env, deck, user) }, 200);
}

/* The card goes and what anybody knew about it goes with it. Leaving the
   progress row would put a card somebody deleted back into their count the
   next time a card was minted with the same id, which is never — but the row
   would still be a fact about nothing. */
async function dropCard(context, body, user, deck) {
  const { env } = context;

  const id = String(typeof body.card === 'string' ? body.card : '');
  if (!MINTED.test(id)) return json({ error: 'not-found' }, 404);

  const now = Date.now();
  await env.DB.batch([
    env.DB.prepare('DELETE FROM flashcard_known WHERE deck_id = ? AND card_id = ?').bind(deck.id, id),
    env.DB.prepare('DELETE FROM flashcard_cards WHERE id = ? AND deck_id = ?').bind(id, deck.id),
    env.DB.prepare('UPDATE flashcard_decks SET updated_at = ? WHERE id = ?').bind(now, deck.id)
  ]);

  return json({ deck: await ownDeckAnswer(env, deck, user) }, 200);
}

/* Both sides, changed in place. `created_at` is left alone on purpose: it is
   what cardsOf() orders by, and a typo fixed a week later must not jump that
   word to the back of the editor or to the front of the next run — see
   startRun() in assets/flashcard.js for what "the front" means there. A card
   that has been learnt keeps what it has been learnt as, wrong side and all;
   editing the words is not a way to reset the spacing, and dropping the card
   and adding it again already does that for anybody who wants it. */
async function editCard(context, body, user, deck) {
  const { env } = context;

  const id = String(typeof body.card === 'string' ? body.card : '');
  if (!MINTED.test(id)) return json({ error: 'not-found' }, 404);

  const front = words(body.front, MAX_SIDE);
  const back = words(body.back, MAX_SIDE);
  if (!front) return json({ error: 'front' }, 400);
  if (!back) return json({ error: 'back' }, 400);

  const now = Date.now();
  await env.DB.batch([
    env.DB
      .prepare('UPDATE flashcard_cards SET front = ?, back = ? WHERE id = ? AND deck_id = ?')
      .bind(front, back, id, deck.id),
    env.DB.prepare('UPDATE flashcard_decks SET updated_at = ? WHERE id = ?').bind(now, deck.id)
  ]);

  return json({ deck: await ownDeckAnswer(env, deck, user) }, 200);
}

/* ----------------------------------------------------------- knew it, or not
 * The whole of what an account buys here, and the only write most people will
 * ever make. It is two actions rather than one flag because a row existing IS
 * the fact — see flashcard_known in db/schema.sql — so knowing a card is an
 * insert and forgetting it is a delete, and neither needs to read the other
 * first.
 *
 * The card is checked against the deck it claims to be in, whichever kind of
 * deck that is. Without that, this route would write any pair of strings a
 * request cared to send into a table nobody ever looks at closely.
 */
async function mark(context, body, user, knew) {
  const { env } = context;

  const deckId = String(typeof body.deck === 'string' ? body.deck : '');
  const cardId = String(typeof body.card === 'string' ? body.card : '');

  let real = false;
  if (MINTED.test(deckId)) {
    const deck = await deckOf(env, deckId, user);
    if (deck && MINTED.test(cardId)) {
      const row = await env.DB
        .prepare('SELECT id FROM flashcard_cards WHERE id = ? AND deck_id = ?')
        .bind(cardId, deckId)
        .first();
      real = !!row;
    }
  } else if (WRITTEN.test(deckId) && WRITTEN.test(cardId)) {
    const deck = shippedDeck(await shipped(context), deckId);
    real = !!deck && deck.cards.some((c) => c.id === cardId);
  }
  if (!real) return json({ error: 'not-found' }, 404);

  if (knew) {
    /* Up a box, and away for as long as that box is worth. The box it goes to
       is read first rather than nudged in SQL, because "the next one after
       whatever it is now, and not past the last" is an arithmetic nobody
       should have to read out of an UPDATE — and the row usually does not
       exist yet, which is a card arriving in box one. */
    const now = Date.now();
    await readingBoxes(env, async (boxes) => {
      if (!boxes) {
        return env.DB
          .prepare('INSERT OR REPLACE INTO flashcard_known (user_id, deck_id, card_id, seen_at) VALUES (?, ?, ?, ?)')
          .bind(user.id, deckId, cardId, now)
          .run();
      }
      const had = await env.DB
        .prepare('SELECT box FROM flashcard_known WHERE user_id = ? AND deck_id = ? AND card_id = ?')
        .bind(user.id, deckId, cardId)
        .first();
      const box = Math.min((had && had.box ? had.box : 0) + 1, MAX_BOX);
      return env.DB
        .prepare('INSERT OR REPLACE INTO flashcard_known (user_id, deck_id, card_id, seen_at, box, due_at) ' +
                 'VALUES (?, ?, ?, ?, ?, ?)')
        .bind(user.id, deckId, cardId, now, box, now + BOXES[box - 1])
        .run();
    });
  } else {
    /* Into box nought, where the missed deck finds it — rather than deleted,
       which is what this did before there was a missed deck and which threw
       away the one thing somebody wanted to look at afterwards. Due now, so
       it is in the next run of its own deck as well: getting a card wrong
       should not take it out of the deck it belongs to. */
    await readingBoxes(env, (boxes) =>
      env.DB
        .prepare(boxes
          ? 'INSERT OR REPLACE INTO flashcard_known (user_id, deck_id, card_id, seen_at, box, due_at) ' +
            'VALUES (?, ?, ?, ?, ?, ?)'
          : 'DELETE FROM flashcard_known WHERE user_id = ? AND deck_id = ? AND card_id = ?')
        .bind(...(boxes
          ? [user.id, deckId, cardId, Date.now(), MISSED, Date.now()]
          : [user.id, deckId, cardId]))
        .run());
  }

  return json({ ok: true }, 200);
}

/* Start a deck again: this person's rows for it, and nobody else's. Reachable
   for a built-in deck as well as for one of your own, which is why it is not
   behind the ownership check the four above share — deckId is bound, never
   concatenated, and the user_id in the WHERE is the session's. */
async function reset(context, user, deckId) {
  const { env } = context;

  const id = String(deckId || '');
  if (!MINTED.test(id) && !WRITTEN.test(id)) return json({ error: 'not-found' }, 404);

  /* The review deck has nothing of its own to forget: it is every known row
     there is, and "forget everything I know" is not a button this site
     offers, so the page never sends this and the route refuses it rather
     than deleting nothing under a name and reporting that it did. */
  if (id === REVIEW_DECK) return json({ error: 'not-found' }, 404);

  /* Emptying the missed deck is not deleting a deck's rows — it is taking the
     nought off every card that is in it, wherever it came from. Those cards go
     back to being unseen, which is what "forget what I know" means there. */
  if (id === MISSED_DECK) {
    await readingBoxes(env, (boxes) =>
      env.DB
        .prepare(boxes
          ? 'DELETE FROM flashcard_known WHERE user_id = ? AND box = ?'
          : 'DELETE FROM flashcard_known WHERE user_id = ? AND deck_id = ?')
        .bind(...(boxes ? [user.id, MISSED] : [user.id, id]))
        .run());
    return json({ reset: id }, 200);
  }

  await env.DB
    .prepare('DELETE FROM flashcard_known WHERE user_id = ? AND deck_id = ?')
    .bind(user.id, id)
    .run();

  return json({ reset: id }, 200);
}

/* ------------------------------------------------------- this card is wrong
 * The Estonian on this site is mine. The forms are the forms of common words
 * and I am confident in them; none of it has been read by anybody who grew up
 * with the language. The people turning the cards over are the only
 * proofreaders this deck has, and until now they had nowhere to say so.
 *
 * One press, no box to type in, no reason to choose from: what a reader can
 * tell me reliably is *that* something on this card is wrong, and the language
 * they were reading it in — which is two thirds of finding it, because a card's
 * back is written in three. Everything else is mine to look at.
 *
 * Nothing comes back but ok. There is no count on the card and there will not
 * be one: a number under a word would tell somebody learning it to distrust a
 * card that is very often perfectly right.
 */
async function report(context, body) {
  const { request, env } = context;

  /* The fingerprint is the whole of who this row belongs to, so without the
     salt there is nothing to file it under. Fail closed rather than write a
     row every press adds to — see /api/saves, which takes the same bargain for
     the same reason. */
  if (!env.SAVE_SALT) return json({ error: 'no-salt' }, 503);

  const deckId = String(typeof body.deck === 'string' ? body.deck : '');
  const cardId = String(typeof body.card === 'string' ? body.card : '');

  /* Only a card the site ships, and only one that is really in the deck it
     claims to be in. A deck somebody wrote has an editor with a Remove on
     every row, so a report about one would be a loop; a pair of strings that
     is in no deck at all is what this check exists to keep out of the table. */
  if (!WRITTEN.test(deckId) || !WRITTEN.test(cardId)) return json({ error: 'not-found' }, 404);
  const deck = shippedDeck(await shipped(context), deckId);
  if (!deck || !deck.cards.some((c) => c.id === cardId)) return json({ error: 'not-found' }, 404);

  /* Settled the same way the page's words are, against the same three, so
     what is stored is a language a card actually has a back in rather than
     whatever was sent. A report says which of the backs was on screen, and
     there are three of those. */
  const { lang } = await wordsFor(context, body.lang, DECK_LANGS);

  const hash = await fingerprint(
    env.SAVE_SALT, clientIp(request), request.headers.get('user-agent') || ''
  );
  const now = Date.now();

  /* The table arrives by hand and a deploy does not wait for it, so there is
     always an afternoon where this code knows about it and the database does
     not. That afternoon is a press that says it did not work — which is true —
     rather than a 500, which is the one thing a route here must never answer. */
  try {
    const seen = await env.DB
      .prepare('SELECT COUNT(*) AS n FROM flashcard_reports WHERE ip_hash = ? AND created_at > ?')
      .bind(hash, now - HOUR)
      .first();
    if (seen && seen.n >= REPORTS_PER_HOUR) return json({ error: 'often' }, 429);

    /* OR IGNORE, because the fingerprint is in the primary key: pressing the
       same card again from the same network is the same person saying the same
       thing, and the answer is still yes. */
    await env.DB
      .prepare('INSERT OR IGNORE INTO flashcard_reports (deck_id, card_id, lang, ip_hash, created_at) ' +
               'VALUES (?, ?, ?, ?, ?)')
      .bind(deckId, cardId, lang, hash, now)
      .run();
  } catch (e) {
    return json({ error: 'no-table' }, 503);
  }

  return json({ ok: true }, 200);
}
