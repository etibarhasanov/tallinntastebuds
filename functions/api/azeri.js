/**
 * Tallinn Tastebuds — /api/azeri, the films shelf of the Azerbaijan corner.
 *
 * /azeri is a page about Azerbaijan for members only, in Azerbaijani and
 * English, linked from nowhere. Its first shelf is the country's cinema: the
 * 2,615 films of the Azerbaijani Wikipedia's list, collected by
 * tools/azfilms.mjs into azeri/data/films.json. This route is the only way
 * to read them.
 *
 * WHY A ROUTE AND NOT THE FILE
 *
 * The file is behind the members' door, and a static file has no door:
 * _routes.json hands /data/* to the asset server past every Function. So the
 * file lives under /azeri/data/, which functions/_middleware.js answers with
 * the not-found page for everybody, and this reads it through env.ASSETS,
 * which goes around the middleware — the way every other Function reads a
 * data file.
 *
 * WHAT IT COSTS
 *
 * One read of the database per request, and it is the session: a lookup on
 * sessions' primary key, token_hash, joined to users by theirs — one row of
 * each, two at most when a browser carries two cookies (sessionTokens() in
 * _lib.js). Everything else is the file, kept five minutes per isolate by
 * dataFile(), and filtered, searched and paged in memory. So a member
 * scrolling the whole of the feature films — seven pages — is seven session
 * reads, and a hundred members doing it every day of the month is under
 * 1,500 reads a day against the five million. Nothing here grows with the
 * films, because the films are not in the database.
 *
 * WHAT IT ANSWERS
 *
 *   GET /api/azeri?kind=feature&q=&watch=1&after=<id>
 *
 *   kind    feature (the default), animation, documentary, series, or all.
 *           "documentary" takes in the docudramas, the newsreel sketches and
 *           the filmed concerts; "series" the filmed plays and anthologies
 *           too, so every film is on exactly one shelf besides All.
 *   q       words to find in the title, its English title, the director,
 *           the writer and the cast, folded so "e" finds "ə" and "i" "ı".
 *   watch   1 for only the films with a link to watch them.
 *   after   the id of the last film of the page before, for the next.
 *
 *   { films: [ … PAGE of them ], next: <id or null>, total, counts, source }
 *
 * `total` is how many match, `counts` how many each shelf holds with the
 * search and the switch applied, so the chips can say. A film carries every
 * field the file has, since the page opens a row without asking again.
 *
 * Signed out it is 401 `signed-out` and nothing else, so the page draws its
 * door; without a database, 503 `no-database`, the same as every route that
 * needs a session. Newest first, the films with no year last, then by title.
 */

import { json, sessionUser, dataFile, foldWords, wrongDatabase } from './_lib.js';

const FILE = '/azeri/data/films.json';
const PAGE = 50;
const MAX_Q = 80;

const SHELVES = {
  feature: ['feature', 'musical'],
  animation: ['animation'],
  documentary: ['documentary', 'docudrama', 'newsreel', 'concert'],
  series: ['series', 'play', 'anthology', 'other'],
};
const SHELF_OF = {};
for (const [shelf, kinds] of Object.entries(SHELVES)) for (const k of kinds) SHELF_OF[k] = shelf;

/* foldWords() leaves ə and ı as they are, since neither has a base letter
   NFD can take its mark off; on this shelf they are the two letters a person
   typing on an English keyboard writes as e and i. */
function fold(value) {
  return foldWords(value).replace(/ə/g, 'e').replace(/ı/g, 'i');
}

/* The shelf sorted once per copy of the file, with each film's search text
   beside it: the file is kept five minutes, and so is this. */
let sorted = null;
let sortedFrom = null;

function shelf(file) {
  if (sorted && sortedFrom === file) return sorted;
  sorted = file.films
    .map((f) => ({
      film: f,
      shelf: SHELF_OF[f.kind] || 'series',
      words: fold([f.title, f.titleEn, f.director.join(' '), f.writer.join(' '), f.cast.join(' ')].join(' ')),
    }))
    .sort((a, b) =>
      (b.film.year || 0) - (a.film.year || 0) || a.film.title.localeCompare(b.film.title, 'az'));
  sortedFrom = file;
  return sorted;
}

export async function onRequestGet(context) {
  const { request, env } = context;
  if (!env.DB || (await wrongDatabase(env))) return json({ error: 'no-database' }, 503);
  if (!(await sessionUser(request, env))) return json({ error: 'signed-out' }, 401);

  let file;
  try {
    file = await dataFile(context, FILE);
  } catch (e) {
    return json({ error: 'unavailable' }, 503);
  }

  const url = new URL(request.url);
  const asked = url.searchParams.get('kind');
  const kind = (SHELVES[asked] || asked === 'all') ? asked : 'feature';
  const words = fold(String(url.searchParams.get('q') || '').slice(0, MAX_Q)).split(' ').filter(Boolean);
  const watch = url.searchParams.get('watch') === '1';
  const after = url.searchParams.get('after') || '';

  const counts = { all: 0, feature: 0, animation: 0, documentary: 0, series: 0 };
  const found = [];
  for (const row of shelf(file)) {
    if (watch && !row.film.watch.length) continue;
    if (words.length && !words.every((w) => row.words.includes(w))) continue;
    counts.all++;
    counts[row.shelf]++;
    if (kind === 'all' || row.shelf === kind) found.push(row.film);
  }

  const start = after ? found.findIndex((f) => f.id === after) + 1 : 0;
  const films = found.slice(start, start + PAGE);
  const next = start + PAGE < found.length ? films[films.length - 1].id : null;

  return json({ films, next, total: found.length, counts, source: file.source });
}
