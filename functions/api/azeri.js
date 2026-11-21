/**
 * Tallinn Tastebuds — /api/azeri, what the Azerbaijan corner is read from.
 *
 * /azeri is a page for anybody, account or not: a home that says what is in
 * it and answers the questions people ask, Azerbaijan's films, beside them a
 * guide to living in Estonia for somebody arriving from there, and the
 * Azerbaijani food in Tallinn on a map. The films are the 2,615 of the
 * Azerbaijani Wikipedia's list, collected by tools/azfilms.mjs into
 * azeri/data/. The home and the guide are four files written by hand under
 * azeri/data/guide/ — home.json, estonia.json, study.json and
 * estonian.json, one to a tab — and every sentence in them is an object
 * keyed by language, az, en, ru and et, as a deck's is. The food is a list
 * of the site's, which the page draws through /embed and asks nothing here
 * for. This route is the only way to read the files.
 *
 * NOBODY SIGNS IN TO READ IT
 *
 * It was the members' corner until 2026-11-21, and this route was its door:
 * a session or 401. The owner opened it that day — reading and watching are
 * for everybody, and an account is for writing something — so it asks
 * nobody who they are, and a film plays for anybody who presses Watch. With
 * nobody's session in it, every answer is the same for everybody and may be
 * kept: five minutes, in the browser and any cache between, which is the
 * five minutes dataFile() keeps the files for anyway.
 *
 * WHY A ROUTE AND NOT THE FILE
 *
 * Because of what a page would cost the phone reading it. The shelf is a
 * 290 KB index and the films beside it in files of a hundred, and a tab of
 * the guide is 26 to 48 KB with all four languages in it; this answers
 * twenty films, or one tab in the one language asked for. So the files
 * live under /azeri/data/, which functions/_middleware.js answers with the
 * not-found page as it does the tools' other working files, and this reads
 * them through env.ASSETS, which goes around the middleware — the way
 * every other Function reads a data file.
 *
 * WHAT IT COSTS
 *
 * Nothing from the database: it reads no row, because the films and the
 * guide are files and nobody's session is asked for. Somebody reading every
 * one of the 523 feature films is twenty-seven requests and no reads, and
 * the number of readers changes the requests and nothing else. The food's
 * map is /embed, which reads /api/v1/lists/<id> — one list's row and its
 * places, the same read whoever asks — and that answer is kept five minutes
 * in each colo, so a colo reads the list at most 288 times a day however
 * many people open the tab.
 *
 * And the CPU, which on the free plan is ten milliseconds a request. The
 * whole shelf as one file was 1.7 MB, and a cold isolate spent four to ten
 * parsing it and twenty-five more sorting and folding it for search, so the
 * tool does that work and writes it down: index.json, 290 KB, every film in
 * the shelf's order with its shelf, year, a watchable flag and its words
 * already folded; and the films themselves in files of a hundred in that
 * order, films/<n>.json. A request walks the index once and parses the one
 * or two files its page is in. All of them are kept five minutes per
 * isolate by dataFile(). A tab of the guide is 26 to 48 KB in all four
 * languages, a fraction of a millisecond to parse, and the answer carries
 * the one language that was asked for.
 *
 * WHAT IT ANSWERS
 *
 *   GET /api/azeri?kind=feature&q=&watch=1&ru=1&page=2
 *
 *   kind    feature (the default), animation, documentary, series, or all.
 *           "documentary" takes in the docudramas, the newsreel sketches and
 *           the filmed concerts; "series" the filmed plays and anthologies
 *           too, so every film is on exactly one shelf besides All.
 *   q       words to find in the title, its English and Russian titles, the
 *           director, the writer and the cast, folded so "e" finds "ə" and
 *           "i" "ı".
 *   watch   1 for only the films with a link to watch them; the page asks
 *           for that first, and a person switches it off.
 *   ru      1 for only the films with a version in Russian — the studio
 *           keeps a Russian playlist, and somebody who reads Russian and not
 *           Azerbaijani wants exactly those.
 *   page    which page of PAGE (twenty), from 1; past the last is the last.
 *
 *   { films: [ … PAGE of them ], page, pages, total, counts, source }
 *
 * `total` is how many match, `counts` how many each shelf holds with the
 * search and the switches applied, so the chips can say. A film carries every
 * field the tool wrote, since the page opens a row without asking again.
 *
 *   GET /api/azeri?tab=estonia&lang=az
 *
 *   tab     home, estonia, study or estonian: the home or a tab of the
 *           guide. Anything else, or nothing, is the films above.
 *   lang    az, en, ru or et, the four the guide is written in; anything
 *           else is English.
 *
 *   { tab, checked, topics: [ { id, name, covers, level, url, body, links } ] }
 *
 * `checked` is the month the tab was last read against its sources,
 * `2026-11`. A topic's `links` are { name, url }, the offices it sends a
 * reader to. Every topic opens in the page, and its `body` is blocks, each
 * one kind under one key:
 *
 *   p       a paragraph.
 *   head    a heading inside the topic.
 *   steps   a numbered list, and list a plain one, of { b, t, url } — a
 *   list    lead in bold, the sentence after it, and where the lead is a
 *           link, its address.
 *   table   { heads, rows }, the flashcards' lesson table: the first column
 *           Estonian, the last what it means.
 *   facts   [ { k, v } ], a label beside its fact.
 *   ladder  { levels, rows, mark, note }: which course covers which level.
 *           A row is { name, span: [from, to] }, a bar, or { name, dots },
 *           a dot at each level; `mark` is the level washed, `note` what
 *           asks for it.
 *   rows    [ { name, why, url } ], rows that lead elsewhere on the site —
 *           a lesson of the flashcards.
 *
 * `level` is the levels a way covers, `0–A2`, said on its row; `url` is the
 * way's own site, the topic's one button. Both are left out where a topic
 * has none. Every string is in the language asked for.
 *
 * The home is the same answer with two things more, and its topics are the
 * questions people ask:
 *
 *   { tab: 'home', checked, say, sections: [ { tab, why } ], topics }
 *
 * `say` is the sentence under the tabs, saying who the corner is for, and
 * `sections` the other tabs in order, each with the line saying what is in
 * it — its name is the tab's own, which the page already has. A question has
 * no `covers`, and its `links` are one address on this site, mostly a tab
 * and a topic of the corner, `/azeri?tab=estonia&topic=housing`, where the
 * answer is written out at length. functions/azeri.js reads the same file
 * to write the home into the page as text.
 *
 * A file that cannot be read is 503 `unavailable`. The order is the
 * index's, which tools/azfilms.mjs writes: the most watched on the studio's
 * YouTube channel first, then the newest, the films with no year last,
 * then by title.
 */

import { json, dataFile, foldWords } from './_lib.js';

const INDEX = '/azeri/data/index.json';
const CHUNKS = '/azeri/data/films/';
const PAGE = 20;
const MAX_Q = 80;
const SHELVES = ['feature', 'animation', 'documentary', 'series'];
const GUIDE = '/azeri/data/guide/';
/* How long an answer may be kept, in seconds: what dataFile() keeps the
   files for, since nothing in an answer changes faster than they do. */
const KEEP = 300;
const TABS = ['home', 'estonia', 'study', 'estonian'];
const GUIDE_LANGS = ['az', 'en', 'ru', 'et'];

/* The same fold tools/azfilms.mjs gave every film's words: foldWords()
   leaves ə and ı as they are, since neither has a base letter NFD can take
   its mark off, and on this shelf they are the two letters an English
   keyboard writes as e and i. Change one, change the other. */
function fold(value) {
  return foldWords(value).replace(/ə/g, 'e').replace(/ı/g, 'i').trim();
}

/* A tab of the guide in one language, or the home. The file holds all four,
   and `say` takes the one asked for out of every string in it: a name that
   is the same in each — TalTech, eesti.ee — is written once, as a string,
   and passes through. tools/validate.mjs holds every object to all four, so
   the English is a fallback nothing should reach. */
function guideIn(file, lang) {
  const say = (text) => (typeof text === 'string' ? text : text[lang] || text.en);
  const item = (it) => ({ ...(it.b ? { b: say(it.b) } : {}), t: say(it.t), ...(it.url ? { url: it.url } : {}) });
  /* One translator a kind of block. tools/validate.mjs holds every block to
     exactly one of these keys, so the first key is the kind. */
  const KINDS = {
    p: say,
    head: say,
    steps: (items) => items.map(item),
    list: (items) => items.map(item),
    table: (t) => ({ heads: t.heads.map(say), rows: t.rows.map((row) => row.map(say)) }),
    facts: (rows) => rows.map((f) => ({ k: say(f.k), v: say(f.v) })),
    ladder: (l) => ({ ...l, rows: l.rows.map((r) => ({ ...r, name: say(r.name) })), note: say(l.note) }),
    rows: (rows) => rows.map((r) => ({ name: say(r.name), why: say(r.why), url: r.url }))
  };
  const block = (b) => {
    const kind = Object.keys(b)[0];
    return { [kind]: KINDS[kind](b[kind]) };
  };
  return {
    tab: file.tab,
    checked: file.checked,
    ...(file.say ? { say: say(file.say) } : {}),
    ...(file.sections ? { sections: file.sections.map((s) => ({ tab: s.tab, why: say(s.why) })) } : {}),
    topics: file.topics.map((topic) => ({
      id: topic.id,
      name: say(topic.name),
      ...(topic.covers ? { covers: say(topic.covers) } : {}),
      ...(topic.level ? { level: say(topic.level) } : {}),
      ...(topic.url ? { url: topic.url } : {}),
      body: topic.body.map(block),
      links: topic.links.map((l) => ({ name: say(l.name), url: l.url }))
    }))
  };
}

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const tab = url.searchParams.get('tab');
  if (TABS.includes(tab)) {
    const asked = url.searchParams.get('lang');
    try {
      return json(guideIn(await dataFile(context, GUIDE + tab + '.json'), GUIDE_LANGS.includes(asked) ? asked : 'en'), 200, KEEP);
    } catch (e) {
      return json({ error: 'unavailable' }, 503);
    }
  }

  const asked = url.searchParams.get('kind');
  const kind = SHELVES.includes(asked) || asked === 'all' ? asked : 'feature';
  const words = fold(String(url.searchParams.get('q') || '').slice(0, MAX_Q)).split(' ').filter(Boolean);
  const watch = url.searchParams.get('watch') === '1';
  const russian = url.searchParams.get('ru') === '1';
  const askedPage = Number.parseInt(url.searchParams.get('page'), 10);

  try {
    const index = await dataFile(context, INDEX);

    /* One pass over the rows, already in the shelf's order: the counts for
       the chips, and where in the whole order each film of this shelf is. */
    const counts = { all: 0, feature: 0, animation: 0, documentary: 0, series: 0 };
    const found = [];
    index.rows.forEach(([id, shelf, , watchable, text, ru], at) => {
      if (watch && !watchable) return;
      if (russian && !ru) return;
      if (words.length && !words.every((w) => text.includes(w))) return;
      counts.all++;
      counts[shelf]++;
      if (kind === 'all' || shelf === kind) found.push({ id, at });
    });

    /* A page by its number, since a person goes to page 3 and back to 2.
       The index is in memory, so skipping to a page walks nothing that is
       billed — it is OFFSET over an array, not over a table. */
    const pages = Math.max(1, Math.ceil(found.length / PAGE));
    const number = Math.min(Math.max(askedPage || 1, 1), pages);
    const page = found.slice((number - 1) * PAGE, number * PAGE);

    /* The films themselves, out of the one chunk this page is in, or two —
       or a few more, when a search has picked its films from all over. */
    const wanted = [...new Set(page.map((f) => Math.floor(f.at / index.chunk)))];
    const chunks = new Map();
    for (const n of wanted) chunks.set(n, await dataFile(context, CHUNKS + n + '.json'));
    const films = page.map((f) => chunks.get(Math.floor(f.at / index.chunk))[f.at % index.chunk]);

    return json({ films, page: number, pages, total: found.length, counts, source: index.source }, 200, KEEP);
  } catch (e) {
    return json({ error: 'unavailable' }, 503);
  }
}
