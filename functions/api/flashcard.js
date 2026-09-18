/**
 * Tallinn Tastebuds — flashcards, and the Estonian on them.
 *
 * A site about eating in Tallinn is read mostly by people who cannot read the
 * menu. This is the other half of that: ten decks of Estonian, two hundred
 * and three cards, Estonian on the front and English on the back, and a person
 * turning them over one at a time. It lives on its own subdomain —
 * flashcard.tallinntastebuds.ee, routed by functions/_middleware.js — for the
 * reason splitwise does: it is not the map, and a sixth card on the account
 * page reading "Flashcards" would have been a second product filed under
 * somebody's saved places.
 *
 * WHERE THE WORDS ACTUALLY ARE, WHICH IS MOSTLY NOT HERE
 *
 * The decks this site ships are data/decks.json, deployed as a file and read
 * as one through dataFile() below. They are content: somebody edits the
 * repository, the deploy carries them, and every reader gets the same two
 * hundred and three cards. Nothing about them is in the database and nothing needs to
 * be — a row per card per deployment would be a copy of a file that only a
 * deploy changes, and the first thing anybody would have to write is the tool
 * that keeps the two in step.
 *
 * What the tables hold is the two things a file cannot: the decks people
 * write for themselves, and how far each person has got. See
 * **Flashcards** in README.md and the block at the end of db/schema.sql.
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
 * Everything the site ships is readable with no account at all: the ten decks
 * and every card in them are a file, and a file has nobody to check. What an
 * account buys is that pressing "Knew it" is remembered — on the account, not
 * on the device, so the deck you got half through on a phone is half through
 * on a laptop. Signed out, the page keeps the run in memory and offers an
 * account at the end of it. That is the same shape the map's saves have and
 * the same sentence they are offered with.
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
 *   - **Every write takes a session**, including the two that only say a card
 *     was known. There is no device-filed anything here.
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

import { json, sessionUser, wrongDatabase, randomHex, dataFile } from './_lib.js';
import { googleReady } from './_google.js';

/* The decks the site ships, as deployed. */
const DECKS_FILE = '/data/decks.json';

/* Caps, and all of them are about somebody with a script rather than somebody
   learning a language.
 *
 * MAX_CARDS is the one worth arguing about. Two hundred is roughly the whole
 * of what this site ships, in one deck, and well past what anybody turns over
 * in a sitting; past it the thing being asked for is a vocabulary manager and
 * not a deck of cards. */
const MAX_DECKS = 20;
const MAX_CARDS = 200;
const MAX_NAME = 60;
/* Both sides of a card. Sixty characters is a short sentence — "Kas ma saan
   maksta kaardiga?" is thirty-one — and the card draws it at a size somebody
   reads across a table. A paragraph on a flashcard is a note, and notes want
   a different feature. */
const MAX_SIDE = 60;

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

/* Every card this person has said they know, as a Set of "<deck>/<card>".
   One indexed read over their own rows, rather than a query per deck: an
   account that has been through everything this site ships holds two hundred
   rows, which is smaller than the answer the page is about to draw anyway. */
async function knownOf(env, user) {
  if (!user) return new Set();
  const { results } = await env.DB
    .prepare('SELECT deck_id, card_id FROM flashcard_known WHERE user_id = ?')
    .bind(user.id)
    .all();
  return new Set((results || []).map((r) => r.deck_id + '/' + r.card_id));
}

/* One deck as the page reads it, whichever kind of deck it is: one of the
   site's own out of data/decks.json, or one somebody wrote out of the two
   tables. Three callers were building this object by hand and had already
   begun to differ over `why`, which only a shipped deck has — so it is built
   in one place and the differences are the arguments.

   `known` is the Set out of knownOf(), keyed "<deck>/<card>", which is the
   same key the table is keyed on. */
function deckAnswer(deck, cards, own, known) {
  return {
    id: deck.id,
    name: deck.name,
    why: own ? null : (deck.why || null),
    own: own,
    cards: cards.map((c) => ({
      id: c.id,
      front: c.front,
      back: c.back,
      known: known.has(deck.id + '/' + c.id)
    }))
  };
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

  if (asked) {
    const known = await knownOf(env, user);
    const mine = await deckOf(env, asked, user);
    if (mine) {
      const cards = await cardsOf(env, mine.id);
      return json({
        ready: ready,
        google: google,
        user: who,
        deck: deckAnswer(mine, cards, true, known)
      }, 200);
    }

    const deck = shippedDeck(decks, asked);
    /* A deck id that is somebody else's, one that was deleted, and one that
       was never anything are the same answer. */
    if (!deck) return json({ ready: ready, google: google, user: who, error: 'not-found' }, 404);

    return json({
      ready: ready,
      google: google,
      user: who,
      deck: deckAnswer(deck, deck.cards, false, known)
    }, 200);
  }

  const known = await knownOf(env, user);
  const counts = {};
  known.forEach((key) => {
    const deck = key.slice(0, key.indexOf('/'));
    counts[deck] = (counts[deck] || 0) + 1;
  });

  const list = decks.map((d) => ({
    id: d.id,
    name: d.name,
    why: d.why || null,
    cards: d.cards.length,
    known: Math.min(counts[d.id] || 0, d.cards.length),
    own: false
  }));

  if (user) {
    const { results } = await env.DB
      .prepare(
        'SELECT d.id AS id, d.name AS name, ' +
        '(SELECT COUNT(*) FROM flashcard_cards WHERE deck_id = d.id) AS cards ' +
        'FROM flashcard_decks d WHERE d.owner = ? ORDER BY d.updated_at DESC LIMIT ?'
      )
      .bind(user.id, MAX_DECKS)
      .all();
    (results || []).forEach((row) => {
      list.push({
        id: row.id,
        name: row.name,
        why: null,
        cards: row.cards,
        known: Math.min(counts[row.id] || 0, row.cards),
        own: true
      });
    });
  }

  return json({ ready: ready, google: google, user: who, decks: list }, 200);
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

  /* Every write here, the two that only say a card was known included. There
     is nothing on this page filed under a device. */
  const user = await sessionUser(request, env);
  if (!user) return json({ error: 'signed-out' }, 401);

  const action = body.action;
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

  if (action === 'rename') return rename(context, body, user, deck);
  if (action === 'drop')   return dropDeck(context, user, deck);
  if (action === 'card')   return addCard(context, body, user, deck);
  if (action === 'uncard') return dropCard(context, body, user, deck);

  return json({ error: 'action' }, 400);
}

/* One of your own decks, whole, which is what every write that changes a deck
   comes back with — the page redraws from it rather than patching the row it
   just changed. */
async function ownDeckAnswer(env, deck, user) {
  const cards = await cardsOf(env, deck.id);
  const { results } = await env.DB
    .prepare('SELECT card_id FROM flashcard_known WHERE user_id = ? AND deck_id = ?')
    .bind(user.id, deck.id)
    .all();
  const known = new Set((results || []).map((r) => deck.id + '/' + r.card_id));
  return deckAnswer(deck, cards, true, known);
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
    await env.DB
      .prepare('INSERT OR REPLACE INTO flashcard_known (user_id, deck_id, card_id, seen_at) VALUES (?, ?, ?, ?)')
      .bind(user.id, deckId, cardId, Date.now())
      .run();
  } else {
    await env.DB
      .prepare('DELETE FROM flashcard_known WHERE user_id = ? AND deck_id = ? AND card_id = ?')
      .bind(user.id, deckId, cardId)
      .run();
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

  await env.DB
    .prepare('DELETE FROM flashcard_known WHERE user_id = ? AND deck_id = ?')
    .bind(user.id, id)
    .run();

  return json({ reset: id }, 200);
}
