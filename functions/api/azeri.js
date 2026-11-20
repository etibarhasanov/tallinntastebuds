/**
 * Tallinn Tastebuds — /api/azeri, the films shelf of the Azerbaijan corner.
 *
 * /azeri is a page about Azerbaijan for members only, in Azerbaijani and
 * English, linked from nowhere. Its first shelf is the country's cinema: the
 * 2,615 films of the Azerbaijani Wikipedia's list, collected by
 * tools/azfilms.mjs into azeri/data/. This route is the only way to read
 * them.
 *
 * WHY A ROUTE AND NOT THE FILE
 *
 * The films are behind the members' door, and a static file has no door:
 * _routes.json hands /data/* to the asset server past every Function. So
 * they live under /azeri/data/, which functions/_middleware.js answers with
 * the not-found page for everybody, and this reads them through env.ASSETS,
 * which goes around the middleware — the way every other Function reads a
 * data file.
 *
 * WHAT IT COSTS
 *
 * One read of the database per request, and it is the session: a lookup on
 * sessions' primary key, token_hash, joined to users by theirs — one row of
 * each, two at most when a browser carries two cookies (sessionTokens() in
 * _lib.js). Nothing else touches the database, because the films are not in
 * it. A member reading every one of the 523 feature films is twenty-seven
 * pages and twenty-seven reads, and a hundred members doing that every day
 * is 2,700 against the five million; the number does not grow with the
 * films.
 *
 * And the CPU, which on the free plan is ten milliseconds a request. The
 * whole shelf as one file was 1.7 MB, and a cold isolate spent four to ten
 * parsing it and twenty-five more sorting and folding it for search, so the
 * tool does that work and writes it down: index.json, 290 KB, every film in
 * the shelf's order with its shelf, year, a watchable flag and its words
 * already folded; and the films themselves in files of a hundred in that
 * order, films/<n>.json. A request walks the index once and parses the one
 * or two files its page is in. All of them are kept five minutes per
 * isolate by dataFile().

 * WHAT IT ANSWERS
 *
 *   GET /api/azeri?kind=feature&q=&watch=1&page=2
 *
 *   kind    feature (the default), animation, documentary, series, or all.
 *           "documentary" takes in the docudramas, the newsreel sketches and
 *           the filmed concerts; "series" the filmed plays and anthologies
 *           too, so every film is on exactly one shelf besides All.
 *   q       words to find in the title, its English title, the director,
 *           the writer and the cast, folded so "e" finds "ə" and "i" "ı".
 *   watch   1 for only the films with a link to watch them; the page asks
 *           for that first, and a person switches it off.
 *   page    which page of PAGE (twenty), from 1; past the last is the last.
 *
 *   { films: [ … PAGE of them ], page, pages, total, counts, source }
 *
 * `total` is how many match, `counts` how many each shelf holds with the
 * search and the switch applied, so the chips can say. A film carries every
 * field the tool wrote, since the page opens a row without asking again.
 *
 * Signed out it is 401 `signed-out` and nothing else, so the page draws its
 * door; without a database, 503 `no-database`, the same as every route that
 * needs a session. Newest first, the films with no year last, then by title.
 */

import { json, sessionUser, dataFile, foldWords, wrongDatabase } from './_lib.js';

const INDEX = '/azeri/data/index.json';
const CHUNKS = '/azeri/data/films/';
const PAGE = 20;
const MAX_Q = 80;
const SHELVES = ['feature', 'animation', 'documentary', 'series'];

/* The same fold tools/azfilms.mjs gave every film's words: foldWords()
   leaves ə and ı as they are, since neither has a base letter NFD can take
   its mark off, and on this shelf they are the two letters an English
   keyboard writes as e and i. Change one, change the other. */
function fold(value) {
  return foldWords(value).replace(/ə/g, 'e').replace(/ı/g, 'i').trim();
}

export async function onRequestGet(context) {
  const { request, env } = context;
  if (!env.DB || (await wrongDatabase(env))) return json({ error: 'no-database' }, 503);
  if (!(await sessionUser(request, env))) return json({ error: 'signed-out' }, 401);

  const url = new URL(request.url);
  const asked = url.searchParams.get('kind');
  const kind = SHELVES.includes(asked) || asked === 'all' ? asked : 'feature';
  const words = fold(String(url.searchParams.get('q') || '').slice(0, MAX_Q)).split(' ').filter(Boolean);
  const watch = url.searchParams.get('watch') === '1';
  const askedPage = Number.parseInt(url.searchParams.get('page'), 10);

  try {
    const index = await dataFile(context, INDEX);

    /* One pass over the rows, already in the shelf's order: the counts for
       the chips, and where in the whole order each film of this shelf is. */
    const counts = { all: 0, feature: 0, animation: 0, documentary: 0, series: 0 };
    const found = [];
    index.rows.forEach(([id, shelf, , watchable, text], at) => {
      if (watch && !watchable) return;
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

    return json({ films, page: number, pages, total: found.length, counts, source: index.source });
  } catch (e) {
    return json({ error: 'unavailable' }, 503);
  }
}
