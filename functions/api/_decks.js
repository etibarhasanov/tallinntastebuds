/**
 * Tallinn Tastebuds — the decks the flashcards ship, read as the files
 * tools/decks.mjs writes.
 *
 * data/decks.json is the file anybody edits, and it is over a megabyte. Two
 * routes read it whole — /api/flashcard for the shelf and for one deck, and
 * functions/flashcard.js for a deck's text — and on a fresh isolate each paid
 * about four milliseconds to parse it, out of the ten the Workers free plan
 * gives a request, before the database was asked anything. tools/decks.mjs
 * writes the source out into data/decks/: an index for the shelf — every deck
 * with the ids of its cards, every lesson and song without its body — and one
 * file per deck, lesson and song, named by its id. The index is a fraction of
 * the source and a deck's file is one deck; the header of the tool says
 * exactly what each holds, and **Where the words are, and it is mostly not
 * the database** under **Flashcards** in README.md says why.
 *
 * This is the ways of reading that folder, shared by the two routes so that
 * neither carries a copy of the other's filtering: shelf(), the index with
 * each list held to the id shape the routes accept; shippedOne(), one deck,
 * lesson or song out of its file, asked for only when the index says it
 * exists, so an id somebody guessed is never a fetch; and shippedDecks(),
 * several decks at once for the two decks gathered out of somebody's rows,
 * which is the one reader that may still read the source whole. All three go
 * through the five-minute per-isolate cache every data file does. /api/say
 * reads the voice's list out of the same folder on its own, and
 * ./_visitors.js reads the index's ids through the reader every data file
 * goes through.
 *
 * It is a module of the flashcards and leaves with them: nothing outside the
 * feature imports it, which is the reason words() in ./flashcard.js gives for
 * keeping a helper out of _lib.js.
 */

import { dataFile } from './_lib.js';

const DIR = '/data/decks/';

/* The file anybody edits, which shippedDecks() below reads whole when a
   request would otherwise read more than FEW_DECKS files out of the folder. */
const SOURCE = '/data/decks.json';

/* The most deck files one request reads before it reads the source once
   instead. Each file is a subrequest to the asset server, and the Workers
   free plan caps what one request may make — fifty out to the internet, and
   at most thirty-two calls to a binding that invokes a Worker, which
   Cloudflare's documentation does not say whether the assets binding is.
   A learner with words in every deck would otherwise open their review deck
   on fifty-odd fetches; past eight, one read of the source is what this did
   before the decks were cut up, and the same cost. */
const FEW_DECKS = 8;

/* A shipped id as data/decks.json spells one: lowercase words, never the
   sixteen hex characters of a deck somebody wrote — tools/validate.mjs holds
   the file to this and to not looking like a minted id, so the two namespaces
   cannot meet. Both routes test what an address names against it, and it is
   here so that the one path built below is only ever built from an id that
   passed it. */
export const WRITTEN = /^[a-z0-9][a-z0-9-]{0,31}$/;

/* The shelf: the three lists out of the index, each row held to the id shape
   and a deck to having its card ids. A missing or malformed index is three
   empty lists rather than a throw — the page then draws whatever the person's
   own decks are and says nothing is shipped, which is a worse site but not a
   broken one. */
export async function shelf(context) {
  let file;
  try {
    file = await dataFile(context, DIR + 'index.json');
  } catch (e) {
    return { decks: [], lessons: [], songs: [] };
  }
  const list = (key, shaped) => (file && Array.isArray(file[key]) ? file[key] : [])
    .filter((one) => one && WRITTEN.test(String(one.id || '')) && shaped(one));
  return {
    decks: list('decks', (deck) => Array.isArray(deck.cards)),
    lessons: list('lessons', () => true),
    songs: list('songs', () => true)
  };
}

/* One of the three, whole, out of its own file — a deck with its cards, a
   lesson with its body, a song with its verses and words — as { kind, one },
   or null: for an id that is not on the shelf, which is never asked for, and
   for a file that cannot be read or is not the shape the page draws. The
   validator keeps the three lists from sharing an id, so the first list that
   has it is the only one that does. */
export async function shippedOne(context, index, id) {
  const kind = index.decks.some((d) => d.id === id) ? 'deck'
    : index.lessons.some((l) => l.id === id) ? 'lesson'
    : index.songs.some((s) => s.id === id) ? 'song'
    : null;
  if (!kind) return null;
  let one;
  try {
    one = await dataFile(context, DIR + id + '.json');
  } catch (e) {
    return null;
  }
  const whole = !!one && one.id === id && (
    kind === 'deck' ? Array.isArray(one.cards)
    : kind === 'lesson' ? Array.isArray(one.body)
    : Array.isArray(one.verses));
  return whole ? { kind, one } : null;
}

/* Several decks with their cards, as a Map by id, for the two decks gathered
   out of somebody's rows — what they got wrong and what they know, which
   span as many decks as the person has been through. Ids that are not a deck
   on the shelf are dropped before anything is read. Up to FEW_DECKS, each
   deck's own file, side by side; past it, the source once. A file that
   cannot be read leaves its deck out, and the cards in it with it, which is
   what a row naming a deck that does not exist has always done. */
export async function shippedDecks(context, index, ids) {
  const named = ids.filter((id) => index.decks.some((d) => d.id === id));
  const out = new Map();
  if (named.length <= FEW_DECKS) {
    const found = await Promise.all(named.map((id) => shippedOne(context, index, id)));
    found.forEach((one, i) => {
      if (one && one.kind === 'deck') out.set(named[i], one.one);
    });
    return out;
  }
  try {
    const file = await dataFile(context, SOURCE);
    for (const deck of file && Array.isArray(file.decks) ? file.decks : []) {
      if (deck && named.includes(deck.id) && Array.isArray(deck.cards)) out.set(deck.id, deck);
    }
  } catch (e) {
    /* Nothing gathered out of the shipped decks; somebody's own still are. */
  }
  return out;
}
