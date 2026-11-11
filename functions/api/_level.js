/**
 * Tallinn Tastebuds — Find your level: the test, how an answer is marked and
 * where a set of answers puts somebody.
 *
 * The flashcards open two of their four stages on a count of words known — a
 * hundred for Getting by, four hundred for Going deeper — which is the right
 * pace for somebody starting from nothing and a wall for somebody who is not:
 * in November 2026 forty-nine of the fifty-two people with a word to their
 * name were under a hundred, and whoever among them could already order
 * dinner had to press Knew it a hundred times to be shown a card at their
 * level. So there is a test. Twenty-five questions out of about a hundred,
 * easy to hard, and at the end of them a stage: the first one whose questions
 * were not got right. Everything below it is skipped, and it opens.
 *
 * **Find your level** under **Flashcards** in README.md is the argument —
 * and what it replaced, since that section said for a year that there was no
 * test, "not even one to jump a stage with".
 *
 * WHAT IS HERE
 *
 * The questions are content: `level` in data/decks.json names a card or a
 * lesson's example, tools/decks.mjs writes each out whole into
 * data/decks/level.json, and drawn() below picks a test out of that file.
 * marked() says how right one answer is and placed() what stage a set of
 * them comes to. functions/api/flashcard.js calls all three; nothing else
 * does, and this module leaves with the flashcards the way ./_decks.js does.
 *
 * THE PAGE MARKS TOO, AND THE ROUTE DOES NOT TAKE ITS WORD
 *
 * assets/flashcard.js says Right, Almost or Not yet the moment an answer is
 * given, so it carries its own copy of marked() and placed() — LEVEL_DRAW,
 * PASS, NEAR and the fold among them, kept the same by hand because neither
 * dialect imports the other. What is written to the account is this file's
 * verdict on the answers themselves: the page sends what was said, never
 * what it scored.
 */
import { dataFile } from './_lib.js';

/* The deck id a placement is filed under in flashcard_known, with the stage
   as its card: one row, this person, placed here. A fifth of the same trick
   as a lesson read — GRAMMAR_DECK in ./flashcard.js — and for its reason: a
   table of its own for one row a person would be a table nobody needs, and a
   CREATE somebody has to run. tools/decks.mjs reserves the name, since it is
   the name of the questions' file as well. */
export const LEVEL_DECK = 'level';

/* The four stages a test can put somebody at, easiest first — the four
   levels a deck is filed under, in the order the shelf draws them. */
export const STAGES = ['start', 'eat', 'more', 'deep'];

/* The questions that are about grammar rather than a stage's words. They
   open nothing: a stage is a shelf of words, and somebody who knows four
   hundred of them and none of the cases is still better served by the decks
   at their level, with a lesson pointed at. */
export const GRAMMAR = 'grammar';

/* How many questions a test draws from each, in the order it asks them:
   twenty-five. The grammar stands between the stages everybody has and the
   two that are earned, so that a test which stops early — three words missed
   in a row — has usually asked it. */
export const LEVEL_DRAW = { start: 5, eat: 5, grammar: 4, more: 6, deep: 5 };

/* A stage is passed at four answers in five. Lenient, the way the gates are:
   one word forgotten is not a stage unlearnt. */
export const PASS = 0.8;

/* How close a typed answer has to be to count as nearly right — the share of
   its letters that are where they should be. A letter out in a word of five
   or more, or the dots left off an õ. */
export const NEAR = 0.8;

/* What a typed answer is compared as: lower case, with everything that is
   not a letter or a figure turned into one space. The dots stay on — õ is a
   letter of its own in Estonian, and leaving them off is nearly right rather
   than right. */
function folded(text) {
  return String(text == null ? '' : text)
    .toLowerCase()
    .replace(/[^a-z0-9À-ɏ]+/g, ' ')
    .trim();
}

/* How alike two strings are, nought to one: one less the share of the longer
   that would have to be typed again. The textbook edit distance over two
   rows; an answer is at most sixty characters, MAX_SAID below. */
function alike(a, b) {
  if (!a.length || !b.length) return 0;
  let row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const next = [i];
    for (let j = 1; j <= b.length; j++) {
      next[j] = Math.min(row[j] + 1, next[j - 1] + 1, row[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    row = next;
  }
  return 1 - row[b.length] / Math.max(a.length, b.length);
}

/* The longest answer read. A card's front is at most sixty characters —
   MAX_SIDE in ./flashcard.js — so nothing longer can be right. */
const MAX_SAID = 60;

/* How right one answer is: 1, a half, or nought. A question that is picked
   is right or it is not — what was pressed is sent back as it was printed,
   the English of a meaning or the Estonian of a form. One that is written is
   right when it folds to the card's front or to another way of saying it
   the source allows, and half right when it is NEAR. */
export function marked(question, said) {
  const text = String(typeof said === 'string' ? said : '').slice(0, MAX_SAID);
  if (question.kind === 'pick') return text === question.right.en ? 1 : 0;
  if (question.kind === 'gap') return text === question.right ? 1 : 0;
  const mine = folded(text);
  const rights = [question.right].concat(question.also || []).map(folded);
  if (rights.includes(mine)) return 1;
  return rights.some((right) => alike(mine, right) >= NEAR) ? 0.5 : 0;
}

/* Where a set of marks puts somebody: the first stage that was not passed,
   and the last one if all four were. `marks` is [{ stage, mark }], one for
   each question asked — a question never reached is not in it, so a test
   that stopped early has not passed the stages it never asked. A stage is
   passed only on a full draw of its questions: five easy answers sent on
   their own are five answers, not a stage and the three after it. */
export function placed(marks) {
  for (const stage of STAGES) {
    const mine = marks.filter((one) => one.stage === stage);
    const got = mine.reduce((sum, one) => sum + one.mark, 0);
    if (mine.length < LEVEL_DRAW[stage] || got / mine.length < PASS) return stage;
  }
  return STAGES[STAGES.length - 1];
}

/* Every question there is, out of the file tools/decks.mjs writes, or none:
   a test that cannot be read is a test that is not offered, and the page
   says the site did not answer. */
export async function questions(context) {
  try {
    const file = await dataFile(context, '/data/decks/level.json');
    return Array.isArray(file) ? file : [];
  } catch (e) {
    return [];
  }
}

/* `n` of a list, at random, in the order they were drawn. */
function some(list, n) {
  const from = list.slice();
  const out = [];
  while (out.length < n && from.length) out.push(from.splice(Math.floor(Math.random() * from.length), 1)[0]);
  return out;
}

/* A test: LEVEL_DRAW of each kind, in LEVEL_DRAW's order, each time a
   different twenty-five. A question that is picked goes out with three of
   its wrong answers, and the page shuffles the right one in among them. */
export function drawn(all) {
  return Object.keys(LEVEL_DRAW).flatMap((stage) =>
    some(all.filter((one) => one.stage === stage), LEVEL_DRAW[stage])
      .map((one) => (one.kind === 'pick' ? { ...one, wrong: some(one.wrong || [], 3) } : one)));
}
