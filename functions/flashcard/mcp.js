/**
 * Tallinn Tastebuds — the Estonian flashcards, read by an assistant.
 *
 * POST /flashcard/mcp   one JSON-RPC 2.0 message   ->  one JSON-RPC 2.0 answer
 *
 * and the same door at https://flashcard.tallinntastebuds.ee/mcp, which
 * functions/_middleware.js answers by calling this, the way that hostname's
 * root calls the page's route.
 *
 * The map has had a door like this since ../mcp.js: an address an AI
 * assistant is given as a custom connector, after which it can ask the site
 * things in the middle of a conversation. This is the second, for somebody
 * learning Estonian with an assistant beside them. It hands over what the
 * shelf already ships and nothing else — the decks of cards and the grammar
 * lessons out of data/decks.json — so that "how do I say bread", "why is it
 * leiba on the menu" and "give me ten words for a café and test me" are
 * answered out of words somebody wrote down and checked into this
 * repository rather than out of what a model remembers of a small language.
 * Reads only: no model of its own, no AI binding, no database, no write to
 * anything. Nothing a visitor to the site sees changes.
 *
 * The protocol — the transport, the handshake, the errors — is ../_mcp.js,
 * shared with the map's door and argued in its header. **Read by an
 * assistant, the flashcards** under **Flashcards** in README.md is this file
 * in prose, with how to connect it.
 *
 * THREE TOOLS
 *
 * Each tool is its own permission card the first time an assistant calls it
 * — WHY TWO TOOLS, AND NOT FOUR in ../mcp.js — so they are as few as the
 * questions a learner asks are different:
 *
 *   words     a word or a phrase looked up in either direction: typed in
 *             Estonian, English, Azerbaijani or Russian, found on a card
 *             with its forms and its sentence. The dictionary question.
 *   decks     the shelf, or one deck whole with every card. The "teach me"
 *             and "test me" question.
 *   grammar   the lessons, or one lesson whole as a page of text. The "why"
 *             question, and the reason the owner asked for this door.
 *
 * `decks` and `grammar` list unless they are handed an `id` and then read
 * that one whole, the shape `places` and `lists` have next door.
 *
 * And ChatGPT's two, `search` and `fetch`, in the shape OpenAI fixed, because
 * outside Developer mode ChatGPT refuses a connector without them — AND
 * CHATGPT'S TWO in ../mcp.js. Here they cover everything the three do: a
 * search answers lessons, decks and words in one list, and a fetch is a
 * lesson or a deck as a page of text.
 *
 * THREE LANGUAGES, AND A FOURTH THE ASSISTANT WRITES
 *
 * Every meaning and every grammar lesson is written in English, Azerbaijani
 * and Russian — DECK_LANGS in ../api/_lib.js — and each lesson argues from
 * its own language's grammar rather than translating the English: the
 * Russian one says where the prepositions went. `language` picks which, and
 * what a card or a lesson lacks in it answers in English, as the page does.
 *
 * The owner also wanted grammar explained in simple Estonian. Nothing in the
 * file is that — an `et` pack fails the validator, since Estonian is what a
 * card asks and never what it answers — and a lesson written in easy
 * Estonian is content somebody has to write and a native speaker has to
 * read. So the server does not pretend to have it: INSTRUCTIONS tells the
 * assistant that when the learner asks for Estonian, or for any language
 * that is not one of the three, it reads the lesson in English and explains
 * it itself, in short plain sentences, with every Estonian form and example
 * taken from the lesson exactly as written. The forms are the part a model
 * gets wrong and they come from here; the sentences around them are the
 * part it is good at.
 *
 * WHAT IS NOT HERE, ON PURPOSE
 *
 * No songs and no conversations. A song is a living author's verses and a
 * conversation is a sheet from a language course; printing each on the page
 * was the owner's call, made once for the page, and handing them to every
 * assistant that asks is a second call nobody has made. The four decks of a
 * song's words are left out with their songs, because a card's sentence
 * there is a line of the lyrics. tools/decks.mjs leaves them out of
 * words.json for the same reason.
 *
 * No gates. On the page a stage opens when enough words are known — GATES in
 * ../api/flashcard.js — and an account is asked for after five answers. This
 * door asks nobody who they are, so it has nobody to hold a gate against,
 * and what it answers with is what ../flashcard.js already writes into the
 * page as text for anybody with a deck's address. The gate is there to pace
 * a learner, not to keep the words in.
 *
 * No progress: what somebody knows is rows under their account, and there is
 * no sign-in here. The assistant is told to send the learner to the deck's
 * own page to keep score.
 *
 * No voice — /api/say answers a browser, and an assistant has no speaker —
 * and nothing counted: a call is not a visit, as next door.
 */

import { dataFile, foldWords, DECK_LANGS } from '../api/_lib.js';
import { shelf, shippedOne } from '../api/_decks.js';
import { door, bad, optionalString, optionalNumber, named, wordsOf, toolResult, toolError, MAX_QUERY, ANNOTATIONS } from '../_mcp.js';
import { SITE } from '../_shell.js';

const SERVER = {
  name: 'tallinntastebuds-flashcards',
  title: 'Estonian flashcards — Tallinn Tastebuds',
  version: '1.0.0',
  description: 'Estonian for people living in or visiting Tallinn: two and a half thousand words on cards ' +
    'with their forms and example sentences, and grammar lessons explained in English, Russian and Azerbaijani.',
  websiteUrl: SITE + '/flashcard',
  icons: [
    { src: SITE + '/assets/logo/icon-192.png', mimeType: 'image/png', sizes: ['192x192'] },
    { src: SITE + '/assets/logo/icon-48.png', mimeType: 'image/png', sizes: ['48x48'] }
  ]
};

/* The language everything falls back to, and DECK_LANGS' first. */
const DEFAULT_LANG = DECK_LANGS[0];

/* How many words a lookup answers with unless asked, and the most it will. */
const DEFAULT_WORDS = 8;
const MAX_WORDS = 20;

/* The stages a deck is filed under, as the shelf's headings say them, in the
   order a learner meets them; `case` is a deck a grammar lesson is followed
   by. A song's deck is not here and is never answered — WHAT IS NOT HERE. */
const STAGES = {
  start: 'First words',
  eat: 'At a restaurant',
  more: 'Getting by',
  deep: 'Going deeper',
  case: 'Practice for a grammar lesson'
};

const INSTRUCTIONS =
  'These are the Estonian flashcards of Tallinn Tastebuds: decks of Estonian words and phrases with what ' +
  'they mean, their forms and example sentences, and grammar lessons. Use them whenever somebody is ' +
  'learning Estonian or asks what an Estonian word means, how to say something in Estonian, or why a ' +
  'word changes its ending — prefer what these tools answer to what you remember, because Estonian forms ' +
  'are easy to get wrong. ' +
  'Meanings and grammar lessons exist in three languages: English (en), Russian (ru) and Azerbaijani (az). ' +
  'Pass `language` to match the language the learner writes in, and answer them in that language. ' +
  'If the learner wants the explanation in another language — including in simple Estonian, which ' +
  'learners often ask for — read the lesson in English and explain it yourself in that language, in ' +
  'short plain sentences, but take every Estonian form, table row and example sentence from the lesson ' +
  'exactly as written: do not invent or alter Estonian forms. ' +
  'In lesson text, words between asterisks are Estonian. A card\'s `forms` are, for a noun, its genitive ' +
  'and partitive (omastav, osastav), and for a verb its da-infinitive and first person singular; the ' +
  'card\'s `estonian` is the dictionary form. ' +
  'When you teach from a deck or a lesson, give its `url` so the learner can open it on the site, turn ' +
  'the cards over there, hear them spoken and keep track of what they know; these tools cannot hear, ' +
  'speak or remember progress. When a lookup finds nothing, say the word is not on these cards before ' +
  'answering from your own knowledge, and say that it is your own.';

/* ------------------------------------------------------------ the tools */

const languageParam = {
  type: 'string',
  enum: DECK_LANGS,
  default: DEFAULT_LANG,
  description: 'The language meanings and explanations come in: en English, ru Russian, az Azerbaijani. ' +
    'Match the language the learner writes in; anything not written in it answers in English.'
};

const CARD_FIELDS = {
  estonian: { type: 'string', description: 'The Estonian, in its dictionary form.' },
  meaning: { type: 'string', description: 'What it means, in the language asked for.' },
  forms: {
    type: 'array', items: { type: 'string' },
    description: 'Two more forms, where the word has them: a noun\'s genitive and partitive, a verb\'s ' +
      'da-infinitive and first person singular.'
  },
  sentence: {
    type: 'object',
    properties: { estonian: { type: 'string' }, meaning: { type: 'string' } },
    description: 'The word in a sentence, where the card has one.'
  }
};

const DECK_FIELDS = {
  id: { type: 'string', description: 'Pass it back as `id` to read the deck whole.' },
  name: { type: 'string' },
  about: { type: 'string', description: 'One line on what is in it.' },
  stage: { type: 'string', description: 'Where it sits on the shelf, easiest first: ' + Object.values(STAGES).join(', ') + '.' },
  cards: { type: 'integer', description: 'How many cards are in it.' },
  url: { type: 'string', description: 'The deck on the site, where its cards are turned over and spoken. Give it.' }
};

const LESSON_FIELDS = {
  id: { type: 'string', description: 'Pass it back as `id` to read the lesson whole.' },
  name: { type: 'string' },
  about: { type: 'string', description: 'One line on what it explains.' },
  example: { type: 'string', description: 'A taste of it, in Estonian.' },
  url: { type: 'string', description: 'The lesson on the site. Give it.' },
  practice_deck: {
    type: ['string', 'null'],
    description: 'The id of the deck that practises this lesson, for the decks tool, or null.'
  }
};

const TOOLS = [
  {
    name: 'words',
    title: 'Look up an Estonian word',
    description:
      'Look a word or a short phrase up on the Estonian flashcards, in either direction: pass it in ' +
      'Estonian ("leib", "aitäh", or an inflected form like "leiba"), or in English, Russian or ' +
      'Azerbaijani ("bread", "хлеб", "çörək"), and the cards that carry it come back with the Estonian ' +
      'in its dictionary form, the meaning, the other forms a learner needs, an example sentence where ' +
      'the card has one, and the deck it is taught in. Use it for "how do you say…", "what does … ' +
      'mean", and to check a form before you write it. Pass the word, not the whole question; accents ' +
      'do not matter. An empty `words` means the word is not on the cards: say so.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', maxLength: MAX_QUERY, description: 'The word or short phrase, in any of the four languages.' },
        language: languageParam,
        limit: {
          type: 'integer', minimum: 1, maximum: MAX_WORDS, default: DEFAULT_WORDS,
          description: 'How many cards at most.'
        }
      },
      required: ['query'],
      additionalProperties: false
    },
    outputSchema: {
      type: 'object',
      properties: {
        words: {
          type: 'array',
          description: 'The cards found, closest match first.',
          items: {
            type: 'object',
            properties: {
              ...CARD_FIELDS,
              deck: { type: 'string', description: 'The id of the deck it is taught in, for the decks tool.' },
              deck_name: { type: 'string' },
              url: { type: 'string', description: 'That deck on the site.' }
            }
          }
        },
        note: { type: 'string', description: 'Present when nothing was found: one sentence saying so.' }
      },
      required: ['words']
    },
    annotations: ANNOTATIONS
  },
  {
    name: 'decks',
    title: 'Estonian flashcard decks',
    description:
      'The decks of Estonian flashcards, or one of them whole. With no `id`, every deck comes back — ' +
      'its name, a line on what is in it, how many cards, and its stage on the shelf from "First ' +
      'words" to "Going deeper" — so you can suggest where to start or find the deck for a subject: ' +
      'greetings, numbers, food, a café, family, verbs, the cases. Pass a word in `query` to narrow ' +
      'them. With an `id`, that deck comes back with every card: the Estonian, the meaning, the forms ' +
      'and an example sentence where the card has one. Use it to teach a subject, to make a word list, ' +
      'or to quiz the learner on a deck — ask a few cards at a time rather than printing all of them.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Read this one deck whole, by the id an earlier answer gave. Leave it out for the shelf.' },
        query: { type: 'string', maxLength: MAX_QUERY, description: 'A word or two to narrow the shelf by: a subject, in any of the three languages.' },
        language: languageParam
      },
      additionalProperties: false
    },
    outputSchema: {
      type: 'object',
      properties: {
        decks: {
          type: 'array',
          description: 'The decks, in the order a learner meets them, or the one deck asked for by id with its cards in `words`.',
          items: {
            type: 'object',
            properties: {
              ...DECK_FIELDS,
              words: {
                type: 'array', items: { type: 'object', properties: CARD_FIELDS },
                description: 'Every card, when the deck was read by id.'
              },
              lesson: {
                type: 'string',
                description: 'The id of the grammar lesson this deck practises, for the grammar tool, where there is one.'
              }
            }
          }
        },
        note: { type: 'string', description: 'Present when nothing fits: one sentence saying so.' }
      },
      required: ['decks']
    },
    annotations: ANNOTATIONS
  },
  {
    name: 'grammar',
    title: 'Estonian grammar lessons',
    description:
      'The grammar lessons of the Estonian flashcards, or one of them whole. With no `id`, every lesson ' +
      'comes back with its name and a line on what it explains — why a noun has three forms, the ' +
      'fourteen cases and each group of them, verb forms and tenses, adjectives, how street names are ' +
      'built. With an `id`, the lesson comes back as `text`: paragraphs, tables of forms and example ' +
      'sentences, written in the language asked for — English, Russian or Azerbaijani, each argued ' +
      'from that language\'s own grammar. Use it whenever the learner asks why a word changes, which ' +
      'case or ending to use, or for an explanation of a rule, and base your explanation on the ' +
      'lesson. For any other language, simple Estonian included, read it in English and explain it ' +
      'yourself, keeping the Estonian forms and examples exactly as the lesson has them.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Read this one lesson whole, by the id an earlier answer gave. Leave it out for the list.' },
        language: languageParam
      },
      additionalProperties: false
    },
    outputSchema: {
      type: 'object',
      properties: {
        lessons: {
          type: 'array',
          description: 'Every lesson, in the order they are taught, or the one asked for by id with its `text`.',
          items: {
            type: 'object',
            properties: {
              ...LESSON_FIELDS,
              language: { type: 'string', description: 'The language `text` is written in.' },
              text: {
                type: 'string',
                description: 'The lesson, as Markdown, when it was read by id. Words between asterisks are Estonian.'
              }
            }
          }
        }
      },
      required: ['lessons']
    },
    annotations: ANNOTATIONS
  },
  /* ChatGPT's two, in the shape it fixed. No outputSchema: the shape is the
     text block's JSON, which is what ChatGPT reads. */
  {
    name: 'search',
    title: 'Search the Estonian flashcards',
    description:
      'Search the Estonian flashcards of Tallinn Tastebuds by a word or two: grammar lessons and decks ' +
      'by what they are about, and single words in Estonian, English, Russian or Azerbaijani. Answers ' +
      'with ids, titles and links; pass an id to `fetch` for the lesson or the deck as text. When you ' +
      'can call `words`, `decks` and `grammar` instead, do: they answer in the learner\'s language.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', maxLength: MAX_QUERY, description: 'A word or two to look for.' }
      },
      required: ['query'],
      additionalProperties: false
    },
    annotations: ANNOTATIONS
  },
  {
    name: 'fetch',
    title: 'Read a lesson or a deck of the Estonian flashcards',
    description:
      'Read one grammar lesson or one deck of the Estonian flashcards whole, in English, by the id ' +
      '`search` gave: a lesson as its explanation with tables of forms and examples, a deck as every ' +
      'word with its meaning, forms and example sentence.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'The id `search` gave.' }
      },
      required: ['id'],
      additionalProperties: false
    },
    annotations: ANNOTATIONS
  }
];

/* --------------------------------------------------------- what is read
 * A pack in the language asked for, English where it has none — means() in
 * assets/flashcard.js, which is the page's rule.
 */
const said = (pack, lang) => pack && (pack[lang] || pack[DEFAULT_LANG]) || '';

/* A deck, a lesson, on the site, in the language the answer is in — the
   ?lang= the page reads off a link, left off for English as the page's own
   links leave it. */
function urlOf(id, lang) {
  return SITE + '/flashcard?d=' + encodeURIComponent(id) + (lang === DEFAULT_LANG ? '' : '&lang=' + lang);
}

function language(args) {
  const value = optionalString(args, 'language', 8);
  if (!value) return DEFAULT_LANG;
  if (!DECK_LANGS.includes(value)) throw bad('language must be one of ' + DECK_LANGS.join(', '));
  return value;
}

/* The shelf as this door sees it: the decks a stage above names, and the
   lessons. The songs, their decks and the conversations stay on the page. */
async function shelved(context) {
  const index = await shelf(context);
  return { ...index, decks: index.decks.filter((deck) => STAGES[deck.level]) };
}

function card(one, lang) {
  const out = { estonian: one.front, meaning: said(one.back, lang) };
  if (Array.isArray(one.forms) && one.forms.length) out.forms = one.forms;
  if (one.sentence && one.sentence.et) {
    out.sentence = { estonian: one.sentence.et, meaning: said(one.sentence, lang) };
  }
  return out;
}

function deckRow(deck, lang) {
  return {
    id: deck.id,
    name: said(deck.name, lang),
    about: said(deck.why, lang),
    stage: STAGES[deck.level],
    cards: deck.cards.length,
    url: urlOf(deck.id, lang)
  };
}

function lessonRow(lesson, lang) {
  return {
    id: lesson.id,
    name: said(lesson.name, lang),
    about: said(lesson.why, lang),
    example: lesson.taste || '',
    url: urlOf(lesson.id, lang),
    practice_deck: lesson.deck || null
  };
}

/* ---------------------------------------------------------------- words
 * A word looked up in data/decks/words.json, which tools/decks.mjs writes:
 * every card with `find`, four strings already folded — the Estonian with
 * its forms, then the back in each of DECK_LANGS — so that this folds what
 * was typed and nothing else. How close a card is:
 *
 *   3  the query is the whole of one thing the card says: "bread" on a back
 *      of "bread", "leiba" among leib's forms, "it" on "This, it", "go" on
 *      "To go"
 *   2  it is a whole word there: "bread" in "black bread", "tere" in
 *      "tere hommikust"
 *   1  it is part of a word: "go" in "good"
 *
 * and a query of several words that is nowhere whole still finds the cards
 * that carry every word of it, last. Ties go to the shorter Estonian — the
 * word before the phrase it is in — and then to the file's order, which is
 * easy before hard.
 */
const PIECES = /\s*[|,;/()]+\s*/;
const TRIM = /^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu;
const LETTER = /[\p{L}\p{N}]/u;

function closeness(find, q) {
  let best = 0;
  for (const text of find) {
    if (!text.includes(q)) continue;
    /* An English verb is written "To go", and nobody looks it up that way. */
    if (text.split(PIECES).some((piece) => [q, 'to ' + q].includes(piece.replace(TRIM, '')))) return 3;
    let whole = false;
    for (let at = text.indexOf(q); at !== -1 && !whole; at = text.indexOf(q, at + 1)) {
      const end = at + q.length;
      whole = (at === 0 || !LETTER.test(text[at - 1])) && (end === text.length || !LETTER.test(text[end]));
    }
    best = Math.max(best, whole ? 2 : 1);
  }
  return best;
}

async function lookUp(context, query, lang, limit) {
  const q = foldWords(query).trim().replace(TRIM, '');
  if (!q) throw bad('query is required');
  const [rows, index] = await Promise.all([dataFile(context, '/data/decks/words.json'), shelved(context)]);
  const names = new Map(index.decks.map((deck) => [deck.id, said(deck.name, lang)]));
  const several = wordsOf(q);

  const found = [];
  rows.forEach((row, i) => {
    if (!names.has(row.deck)) return;
    let rank = closeness(row.find, q);
    if (!rank && several.length > 1 && several.every((word) => row.find.some((text) => text.includes(word)))) rank = 0.5;
    if (rank) found.push({ row, rank, i });
  });
  found.sort((a, b) => b.rank - a.rank || a.row.front.length - b.row.front.length || a.i - b.i);

  return found.slice(0, limit).map(({ row }) => ({
    ...card(row, lang),
    deck: row.deck,
    deck_name: names.get(row.deck),
    url: urlOf(row.deck, lang)
  }));
}

async function words(context, args) {
  const lang = language(args);
  const limit = optionalNumber(args, 'limit');
  const out = {
    words: await lookUp(context, optionalString(args, 'query', MAX_QUERY), lang,
      limit === null ? DEFAULT_WORDS : Math.min(MAX_WORDS, Math.max(1, Math.floor(limit))))
  };
  if (!out.words.length) {
    out.note = 'That is not on the flashcards. Say so, and if you answer from your own knowledge, say that it is yours.';
  }
  return toolResult(out);
}

/* ---------------------------------------------------------------- decks */

/* The decks a few words are about: every word somewhere in the deck's name
   or its line, in any of the three languages. No words is every deck. */
function decksAbout(index, query) {
  const wanted = wordsOf(query);
  if (!wanted.length) return index.decks;
  return index.decks.filter((deck) => {
    const hay = foldWords(DECK_LANGS.map((lang) => (deck.name[lang] || '') + ' ' + (deck.why && deck.why[lang] || '')).join(' ') + ' ' + deck.id);
    return wanted.every((word) => hay.includes(word));
  });
}

/* One deck or lesson out of its own file, or null: an id this door does not
   answer — a song, a conversation, nothing at all — is never a fetch. */
async function read(context, index, id, kind) {
  const listed = kind === 'deck' ? index.decks : index.lessons;
  if (!listed.some((one) => one.id === id)) return null;
  const found = await shippedOne(context, index, id);
  return found && found.kind === kind ? found.one : null;
}

async function decks(context, args) {
  const lang = language(args);
  const index = await shelved(context);
  if (!named(args)) {
    const out = { decks: decksAbout(index, optionalString(args, 'query', MAX_QUERY)).map((deck) => deckRow(deck, lang)) };
    if (!out.decks.length) out.note = 'No deck is about that. Call decks with no query for all of them, or look the word up with the words tool.';
    return toolResult(out);
  }
  const id = optionalString(args, 'id', 40);
  const deck = await read(context, index, id, 'deck');
  if (!deck) return toolError('There is no deck with the id "' + id + '" on the flashcards. Call decks with no id for the ones there are.');
  const row = { ...deckRow(deck, lang), words: deck.cards.map((one) => card(one, lang)) };
  const lesson = index.lessons.find((one) => one.deck === id);
  if (lesson) row.lesson = lesson.id;
  return toolResult({ decks: [row] });
}

/* -------------------------------------------------------------- grammar
 * A lesson's body as Markdown in one language. The blocks are the four
 * tools/validate.mjs holds a lesson to — say, head, table, examples — and a
 * `say` already marks its Estonian between asterisks, which Markdown reads
 * as italics and the assistant is told to read as Estonian.
 */
function lessonText(lesson, lang) {
  const parts = [];
  for (const block of lesson.body) {
    if (block.say) parts.push(said(block.say, lang));
    if (block.head) parts.push('## ' + said(block.head, lang));
    if (block.table) {
      const heads = block.table.heads.map((head) => said(head, lang));
      parts.push([
        '| ' + heads.join(' | ') + ' | |',
        '|' + ' --- |'.repeat(heads.length + 1)
      ].concat(block.table.rows.map((row) =>
        '| ' + row.et.join(' | ') + ' | ' + said(row.means, lang) + ' |')).join('\n'));
    }
    if (block.examples) {
      parts.push(block.examples.map((one) => '- *' + one.et + '* — ' + said(one, lang)).join('\n'));
    }
  }
  return parts.filter(Boolean).join('\n\n');
}

async function grammar(context, args) {
  const lang = language(args);
  const index = await shelved(context);
  if (!named(args)) return toolResult({ lessons: index.lessons.map((lesson) => lessonRow(lesson, lang)) });
  const id = optionalString(args, 'id', 40);
  const lesson = await read(context, index, id, 'lesson');
  if (!lesson) return toolError('There is no grammar lesson with the id "' + id + '". Call grammar with no id for the ones there are.');
  return toolResult({ lessons: [{ ...lessonRow(lesson, lang), language: lang, text: lessonText(lesson, lang) }] });
}

/* ------------------------------------------------------- ChatGPT's two
 * `search`: the lessons and decks a query's words are about, then the words
 * it finds, in one list of { id, title, url }. A word's id is its deck's
 * with the card after a `#`, so two words out of one deck are two results,
 * and `fetch` reads whatever is before the `#`. `fetch`: a lesson as its
 * text, a deck as a line per card, in English.
 */
function lessonsAbout(index, query) {
  const wanted = wordsOf(query);
  return index.lessons.filter((lesson) => {
    const hay = foldWords(said(lesson.name, DEFAULT_LANG) + ' ' + said(lesson.why, DEFAULT_LANG) + ' grammar ' + lesson.id);
    return wanted.length && wanted.every((word) => hay.includes(word));
  });
}

async function chatgptSearch(context, args) {
  const query = optionalString(args, 'query', MAX_QUERY);
  const index = await shelved(context);
  const found = query.trim() ? await lookUp(context, query, DEFAULT_LANG, DEFAULT_WORDS) : [];
  const shelfRow = (one, what) => ({
    id: one.id,
    title: what + ': ' + said(one.name, DEFAULT_LANG) + ' — ' + said(one.why, DEFAULT_LANG),
    url: urlOf(one.id, DEFAULT_LANG)
  });
  return toolResult({
    results: lessonsAbout(index, query).map((lesson) => shelfRow(lesson, 'Grammar lesson'))
      .concat(query.trim() ? decksAbout(index, query).map((deck) => shelfRow(deck, 'Deck')) : [])
      .concat(found.map((word) => ({
        id: word.deck + '#' + word.estonian,
        title: word.estonian + ' — ' + word.meaning + ' (in the deck ' + word.deck_name + ')',
        url: word.url
      })))
  });
}

function cardLine(one) {
  return one.estonian + (one.forms ? ' (' + one.forms.join(', ') + ')' : '') + ' — ' + one.meaning +
    (one.sentence ? '. *' + one.sentence.estonian + '* — ' + one.sentence.meaning : '');
}

async function chatgptFetch(context, args) {
  const id = optionalString(args, 'id', 120).split('#')[0];
  if (!id) throw bad('id is required');
  const index = await shelved(context);
  const lesson = await read(context, index, id, 'lesson');
  if (lesson) {
    const { name, url, ...metadata } = lessonRow(lesson, DEFAULT_LANG);
    return toolResult({
      id, title: name, url, metadata,
      text: '# ' + name + '\n\n' + metadata.about + '\n\n' + lessonText(lesson, DEFAULT_LANG) +
        '\n\nA grammar lesson of the Estonian flashcards on Tallinn Tastebuds: ' + url
    });
  }
  const deck = await read(context, index, id, 'deck');
  if (!deck) return toolError('There is no lesson or deck with the id "' + id + '" on the flashcards.');
  const { name, url, ...metadata } = deckRow(deck, DEFAULT_LANG);
  return toolResult({
    id, title: name, url, metadata,
    text: '# ' + name + '\n\n' + metadata.about + '\n\nEstonian (other forms) — meaning. Example.\n\n' +
      deck.cards.map((one) => '- ' + cardLine(card(one, DEFAULT_LANG))).join('\n') +
      '\n\nA deck of the Estonian flashcards on Tallinn Tastebuds: ' + url
  });
}

/* --------------------------------------------------------------- the door */
const CALLS = { words, decks, grammar, search: chatgptSearch, fetch: chatgptFetch };

export const onRequest = door({
  server: SERVER,
  instructions: INSTRUCTIONS,
  tools: () => TOOLS,
  call: (context, name, args) => (Object.hasOwn(CALLS, name) ? CALLS[name](context, args) : undefined),
  names: Object.keys(CALLS),
  what: 'The flashcards'
});
