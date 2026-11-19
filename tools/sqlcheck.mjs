#!/usr/bin/env node
/**
 * Tallinn Tastebuds — every statement asked how it reads, before production is.
 *
 * D1 bills the rows a statement walks, not the rows it answers with, and the
 * free plan stops every read on the account at five million a day. On
 * 18 November 2026 the flag counter on Discover took the site past that
 * before noon: three statements that each looked like a small question asked
 * visitor_counts by `kind` and by a span of days, which the table's key —
 * (day, kind, id) — cannot answer, so each walked every row, every five
 * minutes per colo. Lists, saves and profiles answered empty until midnight
 * UTC. Nothing here had asked SQLite how it would run them.
 *
 * This asks. It builds an empty database from db/schema.sql, pulls every
 * statement out of functions/ — string literals joined by `+`, with whatever
 * the code splices in stood in for by a placeholder — and asks SQLite's
 * planner, EXPLAIN QUERY PLAN, for each. A plan that says SCAN on one of the
 * site's tables is a statement that reads the whole table, and the whole
 * table grows: it fails the build unless it is in KNOWN below with the
 * reason it is safe. **The rules of a read** in .claude/skills/api/SKILL.md
 * are what a new statement is held to before it is written; this is the
 * backstop for the day one is missed.
 *
 * And it holds every SELECT to the owner's second rule, drawn on
 * 19 November 2026: no query answers more than a hundred rows, and where
 * more is genuinely needed it is paginated. A read passes with a LIMIT of a
 * hundred or less — a number, a constant, or a `?` bound to one — or by its
 * key, every column of a unique key pinned, or as one aggregate row, or when
 * the code asks it for `.first()`. Anything else is in ROWS with what bounds
 * it in numbers, or marked there to fix, or it fails.
 *
 * WHAT IT CANNOT SEE
 *
 * The planner's answer, not D1's bill. Two things the plan does not show,
 * so they are still the author's to measure with `rows_read` against
 * production (the Cloudflare MCP tool reads it without a prompt, a read of
 * 2,000 rows or fewer — .claude/hooks/d1-write-gate.mjs prices it first):
 *
 *   - A SEARCH that uses only the front of a key, then filters the rest —
 *     `WHERE day >= ? AND kind = 'shown'` is a search on `day` that walks
 *     every row of the span. The plan says SEARCH and means "a range".
 *   - How often a statement runs. A walk of sixty rows once a week is
 *     nothing; a lookup run on every page view is the whole budget.
 *
 * And a statement it cannot rebuild — its shape is decided at runtime by
 * more than a placeholder can stand in for, a table's name spliced in — is
 * priced by hand in UNREAD, or it fails: nothing under functions/ goes
 * unchecked because the tool could not read it.
 *
 * Usage:
 *
 *     node tools/sqlcheck.mjs          every statement; one line when all pass
 *     node tools/sqlcheck.mjs --all    every walk, every listed read and every
 *                                      one to fix, with its reason
 *
 * Exit 1 with a line per statement that walks a table and is not KNOWN, a
 * read past a hundred rows that is not in ROWS, a statement it cannot read
 * that is not in UNREAD, and an entry in ROWS or UNREAD that matches nothing.
 * Zero dependencies: node:sqlite is part of Node from 22.5, and CI runs 22.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

/* node:sqlite says it is experimental on every import; the warning is not
   a finding. */
const emit = process.emitWarning;
process.emitWarning = (w, ...rest) => (String(w).includes('SQLite') ? undefined : emit.call(process, w, ...rest));
const { DatabaseSync } = await import('node:sqlite');

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ALL = process.argv.includes('--all');

/* The walks that are safe, each with why. `file` is the path under
   functions/, `has` a piece of the statement that picks it out. A new entry
   says what bounds the walk — the size of the table, or how often it runs —
   in numbers, the way the ones here do. Everything under api/admin/ is the
   owner's alone and is read a few times a day: ADMIN below. */
const KNOWN = [
  { file: 'api/_lib.js', has: 'SELECT * FROM google_venues', why: "googleTable()'s whole read, ~1,180 rows: once a day per isolate, and after the week's ranking or an export load; between them only the rows changed_at names" },
  { file: 'api/venues.js', has: 'FROM google_venues', why: "roll() with no ids and no map id, the whole ~1,180 rows: only /api/admin/venues asks for it, the owner's" },
  { file: 'api/_refresh.js', has: 'FROM google_venues', why: 'the refresh of Google places: a scheduled job and the owner, ~1,200 rows' },
  { file: 'api/_rank.js', has: 'google_venues', why: 'the weekly re-rank, once a week' },
  { file: 'api/_rank.js', has: 'FROM google_reranks', why: 'one row a week, 52 a year' },
  { file: 'api/_visitors.js', has: 'FROM visitor_live', why: 'a ring of LIVE_SPAN slots, 60 rows for ever' },
  { file: 'api/_account.js', has: 'DELETE FROM login_fails', why: 'old failed sign-ins only; the table holds a day of them' },
  { file: 'api/account.js', has: 'DELETE FROM username_holds', why: 'released names past their hold; one row per renamed account' },
  { file: 'api/account.js', has: 'NOT IN (SELECT place_id FROM list_items)', why: 'deleting an account, once per account' },
  { file: 'api/chess.js', has: 'FROM chess_games g', why: 'a fragment: the WHERE that names the game is added where it is used' },
  { file: 'api/chess.js', has: 'DELETE FROM chess_games WHERE', why: 'a fragment: PAIR names the two players' },
  { file: 'api/chess.js', has: 'MAX(n)', why: "a game's number, when a game is started: the games of one kind" },
  { file: 'api/chess.js', has: 'FROM users WHERE username LIKE', why: 'finding an opponent by name, signed in: the accounts, 81 in November 2026' },
  { file: 'api/_posts.js', has: 'ORDER BY COALESCE(p.published_at, p.updated_at) DESC', why: "readPage()'s WHERE is its caller's — p.status = 'published' or p.owner = ? in posts.js — and each searches an index of posts" },
  { file: 'api/_flows.js', has: 'WITH RECURSIVE f(flow)', why: 'FIRST_DAY: MIN(flow) and MIN(day) per flow are each one row by the key, 54 rows in all on 18 Nov 2026 — the planner cannot tell its parts apart' },
  { file: 'api/_visitors.js', has: 'SELECT MIN(day) AS day FROM visitor_counts WHERE kind', why: 'stops at the first day the kind has a row, so it reads the days before that kind began and no more: 1,757 rows on 18 Nov 2026 for the latest, and that number does not grow. The owner\'s pages only' },
];
const ADMIN = 'api/admin/';

/* The reads that answer more than a hundred rows, or that answer fewer for
   a reason the statement cannot show — a cap enforced where the rows are
   written, a constant the LIMIT is handed that this tool cannot follow —
   each with what bounds it, in numbers. The rule they are excepted from is
   under **the answer** below.

   An entry with `fix` is not an exception: it is a read the owner has said
   must change, left passing so the build stays green while it does, and
   `fix` says who has it. `node tools/sqlcheck.mjs` lists every one on each
   run, so the list is never quiet about what it owes. Everything under
   api/admin/ is the owner's alone, a few opens a day, and passes as ADMIN
   does above — except where an entry here says it is to fix. An entry that
   no longer matches a statement fails the build, so the list cannot outlive
   what it describes. */
const SESSION = 'nobody yet: found by the audit of 19 Nov 2026, outside the list the owner handed out';
const ROWS = [
  /* Allowed for now, by the owner on 19 November 2026. */
  { file: 'api/_lib.js', has: 'SELECT * FROM google_venues WHERE changed_at > ?', why: "googleTable(): the rows changed since the isolate's last look, a handful a day and the whole ~1,180 after an export load" },
  { file: 'api/_lib.js', has: 'SELECT * FROM google_venues', why: "googleTable()'s whole read, ~1,180 rows, once a day per isolate" },
  { file: 'api/_rank.js', has: 'FROM google_ranks r JOIN google_venues v', why: 'the week\'s top: r.rank <= TOP, a hundred rows, bound as ?2' },
  { file: 'api/_refresh.js', has: 'SELECT place_id FROM google_venues WHERE hidden = 0', why: "the day's fill: LIMIT is the day's room under BUDGET.details.day, thirty-two at most" },
  { file: 'api/_visitors.js', has: 'SELECT day, kind, id, n FROM visitor_counts WHERE day >= ? AND day <= ?', why: "the owner's pages: the days missing from the colo, read once each and then kept — a few hundred rows a day of the range" },
  { file: 'api/_visitors.js', has: 'SELECT day, kind, id, n FROM visitor_counts WHERE day >= ?', why: "the owner's pages: yesterday and today, a few hundred rows a day" },
  { file: 'api/_visitors.js', has: "FROM visitor_counts WHERE day = ?1 AND kind = 'shown'", why: "the flag counter: one day's 'shown' rows, one a country, a few dozen; through the colo for five minutes" },
  { file: 'api/_visitors.js', has: "kind IN ('visitor', 'desktop.visitor', 'country') UNION ALL", why: "the flag counter's estimate of one day: its visitors and countries, a few dozen rows" },
  { file: 'api/_flows.js', has: 'SELECT flow, day, who, id, n FROM flow_counts WHERE flow IN (?, ?) AND day >= ?', why: "/admin/flows, the owner's: one diagram's days, or its phones' beside them, a few dozen rows a day of the range" },

  /* Bounded at a hundred or fewer, by something the statement does not say. */
  { file: 'api/_lists.js', has: 'FROM list_items WHERE list_id = ? ORDER BY pos', why: 'one list\'s places: MAX_ITEMS in lists.js, fifty' },
  { file: 'api/lists.js', has: 'SELECT place_id FROM list_items WHERE list_id = ? ORDER BY pos', why: 'one list\'s places: MAX_ITEMS, fifty' },
  { file: 'api/walk.js', has: 'FROM walk_checks WHERE user_id = ? AND list_id = ? ORDER BY checked_at', why: 'one walker\'s checks on one list: a check a place, MAX_ITEMS, fifty' },
  { file: 'api/walk.js', has: 'SELECT place FROM walk_checks WHERE user_id = ? AND list_id = ?', why: 'one walker\'s checks on one list: a check a place, MAX_ITEMS, fifty' },
  { file: 'api/_mostkept.js', has: 'LEFT JOIN users u ON u.id = l.owner', why: 'LIMIT PAGE + 1, twenty-one — the bound list is spread, so the tool cannot count to it' },
  { file: 'api/_posts.js', has: 'ORDER BY COALESCE(p.published_at, p.updated_at) DESC, p.id DESC LIMIT ?', why: 'LIMIT PAGE_SIZE + 1, eleven — the bound list is spread, so the tool cannot count to it' },
  { file: 'api/_posts.js', has: 'SELECT lang, title, standfirst, body, words FROM post_texts WHERE post = ?', why: 'one post\'s texts: a row a language, eleven at most' },
  { file: 'api/_posts.js', has: 'SELECT post, lang, title, standfirst, words FROM post_texts WHERE post IN', why: "a page of PAGE_SIZE ten posts, a text a language: 110 at the very most and one or two each in fact" },
  { file: 'api/_profile.js', has: 'FROM profile_rows WHERE owner = ? ORDER BY position', why: 'one page of links: MAX_ROWS, twenty' },
  { file: 'api/_profile.js', has: 'FROM lists l WHERE l.owner = ? AND l.public = 1 ORDER BY l.updated_at DESC', why: 'one account\'s public lists: MAX_LISTS in _lists.js, twenty-four' },
  { file: 'api/lists.js', has: 'FROM lists l WHERE l.owner = ? ORDER BY l.updated_at DESC', why: 'one account\'s own lists: MAX_LISTS, twenty-four' },
  { file: 'api/_visits.js', has: 'SELECT l.id, l.title, l.public, ? AS n FROM lists l WHERE l.owner = ?', why: 'one account\'s lists: MAX_LISTS, twenty-four' },
  { file: 'api/_visits.js', has: 'SELECT id, title FROM lists WHERE owner = ? AND public = 1', why: 'one account\'s public lists: MAX_LISTS, twenty-four' },
  { file: 'api/_ridecells.js', has: 'WITH RECURSIVE r(n)', why: 'LIMIT ?6 is `near`: NEAR in rides.js, forty, its one caller' },
  { file: 'api/_visitors.js', has: 'SELECT minute, n FROM visitor_live WHERE minute > ?', why: 'the last LIVE_SPAN minutes, thirty rows' },
  { file: 'api/_visitors.js', has: 'SELECT day, fresh, visits, secs FROM counter_days WHERE day >= ?', why: 'the last COUNTER_SECS_DAYS days, a row a day, twenty-eight' },
  { file: 'api/chess.js', has: 'SELECT g.*, u.username AS challenger_name FROM chess_games g LEFT JOIN users u ON u.id = g.challenger', why: 'GAME_SQL, a fragment: every use adds the WHERE that names its game and LIMIT 1' },
  { file: 'api/chess.js', has: 'o.username AS opponent_name FROM chess_games g', why: "DUEL_SQL, a fragment: its uses name one game, or one account's duels of the last days" },
  { file: 'api/chess.js', has: 'FROM chess_asks a', why: "one game's asks: keyed (game, kind, by_kind, by_id), three kinds by two sides, six" },
  { file: 'api/chess.js', has: "WHERE g.kind = 'private' AND g.state = 'waiting' ORDER BY g.created_at", why: 'the queue: a challenge is refused past MAX_QUEUE, fifty' },
  { file: 'api/chess.js', has: 'SELECT * FROM (SELECT n.id', why: 'LIMIT NOTES_SHOWN, fifty, inside the subquery the outer one only reorders' },
  { file: 'api/venues.js', has: 'FROM google_venues', why: "roll(): a map id is LIMIT 1 and ?ids= is held to fifty by wantedIds(); the whole roll is /api/admin/venues, the owner's" },
  { file: 'api/_sections.js', has: 'CROSS JOIN ride_sections s ON s.cell = v.column1', why: 'LOOKUP: ASKED squares a statement, fifty, each a seek on ride_sections\' primary key, so a row a square at most' },
  { file: 'api/feedback.js', has: 'MAX(CASE WHEN h.owner = ? THEN 1 ELSE 0 END) AS hearted', why: 'LIMIT PAGE + 1, twenty-one — PAGE is fifty in _lib.js and twenty here, so the tool cannot read the name' },
  { file: 'api/_mostkept.js', has: 'SELECT place_id, name FROM list_items WHERE list_id = ? ORDER BY pos LIMIT', why: 'LIMIT TASTE or DOTS, three or ten, picked by a condition the tool cannot read' },
  { file: 'api/flashcard.js', has: 'SELECT deck_id, known, missed FROM flashcard_progress WHERE user_id = ?', why: 'a row a deck the learner has turned a card of: 53 shipped decks on 21 Nov 2026 and MAX_DECKS twenty of their own, 73; each deck shipped is one more' },

  /* A page of PAGE in _lib.js, fifty, read through inPages() after the last
     page's key: the rule's own way to read more than a hundred. PAGE is
     twenty in other files, so the tool cannot read the name. */
  { file: 'api/_lib.js', has: 'SELECT rowid AS at, place_id FROM saves WHERE owner = ? AND rowid < ?', why: "savedBy(): one account's saves, fifty a page" },
  { file: 'api/saves.js', has: 'SELECT place_id, n FROM save_counts WHERE place_id > ? AND n > 0', why: 'the saved places, fifty a page, on the primary key' },
  { file: 'api/chess.js', has: 'SELECT ply, uci FROM chess_moves WHERE game = ? AND ply > ?', why: "replay(): one game's moves, fifty a page, by ply" },

  /* To fix, and being fixed by other sessions, as the owner set out. */
  { file: 'api/flashcard.js', has: 'SELECT deck_id, card_id, box FROM flashcard_known WHERE user_id = ?', why: 'every card one learner has turned', fix: 'another session: flashcard_known by user, a deck at a time' },
  { file: 'api/lists.js', has: 'FROM added_places WHERE owner = ?', why: 'every place one account added, MAX_ADDED a hundred', fix: 'another session: added_places by owner, paginated' },
  { file: 'api/chess.js', has: 'FROM chess_moves m', why: "one game's moves, every ply", fix: 'another session: chess_moves for a game, paged by ply' },

  /* To fix, and nobody has them: over a hundred, and not on the owner's list. */
  { file: '_public.js', has: 'WHERE l.public = 1 ORDER BY l.id, i.pos LIMIT ?', why: "publicLists(): LIMIT READ_CAP, two thousand, every public list's places for /mcp and /api/v1, five minutes per isolate", fix: SESSION },
  { file: 'blog/sitemap.js', has: "SELECT id, updated_at FROM posts WHERE status = 'published'", why: 'LIMIT MOST, five thousand: every published post, an hour at the edge', fix: SESSION },
  { file: 'blog.js', has: 'SELECT list_id, name FROM list_items WHERE list_id IN', why: "a post's lists' places: MAX_LISTS ten lists of MAX_ITEMS fifty, five hundred", fix: SESSION },
  { file: 'api/rides.js', has: 'FROM rides WHERE user_id = ? ORDER BY created_at DESC LIMIT ?', why: 'LIMIT MINE, two hundred of somebody\'s rides, with their lines when asked', fix: SESSION },
  { file: 'api/flashcard.js', has: 'SELECT id, front, back FROM flashcard_cards WHERE deck_id = ?', why: 'LIMIT MAX_CARDS, two hundred cards of one deck', fix: SESSION },
  { file: 'api/flashcard.js', has: 'SELECT day FROM flashcard_days WHERE user_id = ? ORDER BY day DESC LIMIT 366', why: 'a year of days, for the streak', fix: SESSION },
  { file: 'api/lists.js', has: 'k.created_at AS kept_at', why: "the lists one account keeps: MAX_KEPT, two hundred", fix: SESSION },
  { file: 'api/walk.js', has: 'WHERE c.user_id = ? AND w.finished_at IS NULL', why: "every check on every walk one account has going: a walk a list, fifty a walk, and no cap on walks", fix: SESSION },
  { file: 'api/discover.js', has: "SELECT id, n FROM press_counts WHERE kind = 'place'", why: 'every place ever opened, ours and Google\'s; five minutes per colo', fix: SESSION },
  { file: 'api/discover.js', has: 'FROM walks WHERE finished_at IS NOT NULL AND list_id IN', why: 'every finished walk of the ROUTES five lists, one a walker, growing with the accounts', fix: SESSION },
  { file: 'api/_visits.js', has: 'SELECT p.id, p.lang, p.status, ? AS n FROM posts p WHERE p.owner = ?', why: "one account's published posts: MAX_POSTS, two hundred", fix: SESSION },
  { file: 'api/_visits.js', has: 'SELECT post, lang, title FROM post_texts WHERE post IN', why: 'LIST_BATCH fifty posts at a time, a text a language: up to 550', fix: SESSION },
  { file: 'api/_visits.js', has: 'FROM list_counts', why: 'LIST_BATCH fifty lists at a time, a row a country each', fix: SESSION },
  { file: 'api/_visits.js', has: 'FROM profile_counts', why: "one profile's days of the span, up to ninety, a row a kind and id a day", fix: SESSION }
];

/* The statements this tool cannot rebuild, each priced by hand: a table or
   a column list spliced in that no placeholder can stand for. A new one
   fails the build until it is read or listed here. */
const UNREAD = [
  { file: 'api/_lib.js', has: 'SET ip_hash = ', why: "forgetFingerprints(): UPDATE ${table} for the four tables in FORGET. Each WHERE is length(ip_hash) = 64 AND <at> < ?, and none of the four has an index on <at>, so each walks its table — feedback, chess_notes, saves, flashcard_reports — after every write to them. To fix: a partial index on <at> WHERE length(ip_hash) = 64 would make it the rows still holding one" },
  { file: 'api/_ridecells.js', has: 'INSERT OR IGNORE INTO ride_cells', why: "fileCells(): one INSERT of a ride's squares, the values written in; a write, and no rows read but the key's" },
  { file: 'api/lists.js', has: 'UPDATE lists SET ', why: 'the edit: the columns being set spliced in, WHERE id = ?, one row by the key' },
  { file: 'api/rides.js', has: 'INSERT INTO rides (', why: 'a save: the column list spliced in, one row a run, no read' }
];

function modules(dir) {
  const found = [];
  for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) found.push(...modules(path));
    else if (entry.name.endsWith('.js')) found.push(path);
  }
  return found;
}

/* One string literal at i, as [text, end], or null. A template's ${…} is a
   placeholder like any other spliced piece. */
function literal(src, i) {
  const q = src[i];
  if (q !== "'" && q !== '"' && q !== '`') return null;
  let out = '';
  let j = i + 1;
  while (j < src.length && src[j] !== q) {
    if (src[j] === '\\') { out += src[j + 1]; j += 2; continue; }
    if (q !== '`' && src[j] === '\n') return null;
    if (q === '`' && src[j] === '$' && src[j + 1] === '{') {
      let depth = 1;
      j += 2;
      while (j < src.length && depth) { if (src[j] === '{') depth++; else if (src[j] === '}') depth--; j++; }
      out += ' __X__ ';
      continue;
    }
    out += src[j++];
  }
  return [out, j + 1];
}

/* Past a piece of code spliced into a statement, to the next + , ) or ; at
   its own depth. */
function skipCode(src, i) {
  let depth = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === "'" || c === '"' || c === '`') { const l = literal(src, i); if (!l) return i; i = l[1]; continue; }
    if (c === '(' || c === '[' || c === '{') depth++;
    else if (c === ')' || c === ']' || c === '}') { if (!depth) return i; depth--; }
    else if (!depth && (c === '+' || c === ',' || c === ';')) return i;
    i++;
  }
  return i;
}

const OPENS = /^\s*(?:SELECT|WITH|UPDATE|DELETE|INSERT|REPLACE)\b/i;
const STARTS = /^\s*(SELECT\b|WITH\s+(RECURSIVE\s+)?\w+\s*(\(|AS\b)|UPDATE\s+\w+\s+SET\b|DELETE\s+FROM\b|INSERT\b|REPLACE\s+INTO\b)/i;

/* The upper-case constants that are a string and nothing else — AUTHOR in
   _posts.js, say — so a statement that splices one in is read with it
   rather than with a placeholder. One table for every file: the names are
   distinct, and an import reads the same text as the file that wrote it. */
const CONSTS = new Map();
/* And the ones that are a whole number, which is how a LIMIT is often
   written — `'LIMIT ' + ROUTES`. Numbers are not distinct: MAX_NAME is 60 in
   one file and 80 in another, so a name is read as its number only where
   every file that writes it agrees. */
const NUMBERS = new Map();
function constants(src) {
  for (const m of src.matchAll(/\bconst\s+([A-Z][A-Z0-9_]*)\s*=\s*/g)) {
    let k = m.index + m[0].length;
    const number = /^(\d+)\s*;/.exec(src.slice(k));
    if (number) { (NUMBERS.get(m[1]) || NUMBERS.set(m[1], new Set()).get(m[1])).add(number[1]); continue; }
    const first = literal(src, k);
    if (!first) continue;
    let [text, end] = first;
    k = end;
    let plain = true;
    for (;;) {
      const join = /^\s*\+\s*/.exec(src.slice(k));
      if (!join) break;
      const next = literal(src, k + join[0].length);
      if (!next) { plain = false; break; }
      text += next[0];
      k = next[1];
    }
    if (plain && /^\s*;/.test(src.slice(k)) && !text.includes('__X__')) CONSTS.set(m[1], text);
  }
}

/* What the code does with the statement ending at k: the text of each
   argument it is bound to, which is how a LIMIT ? is read as the number it
   is handed, and whether it is asked for its first row alone — `.first()`
   answers one row whatever the statement would have. */
function chain(src, k) {
  const shut = /^\s*\)/.exec(src.slice(k));
  if (!shut) return { binds: [], first: false };
  let j = k + shut[0].length;
  const args = [];
  const open = /^\s*\.bind\(/.exec(src.slice(j));
  if (open) {
    j += open[0].length;
    while (j < src.length && src[j] !== ')') {
      let end = skipCode(src, j);
      while (src[end] === '+') end = skipCode(src, end + 1);
      args.push(src.slice(j, end).trim());
      j = end;
      if (src[end] !== ',') break;
      j++;
    }
    j++;
  }
  return { binds: args, first: /^\s*\.first\(/.test(src.slice(j)) };
}

/* A statement whose LIMIT is a `?` bound to a constant, read with the
   constant's number in its place: `LIMIT ?` .bind(id, MINE) is LIMIT 200. A
   `?` with a number, ?3, is that argument; a bare one is the next; and
   PAGE + 1 is read as the number it comes to. */
function limitOf(s, used) {
  const tail = /\bLIMIT\s+\?(\d*)(?:\s+OFFSET\s+\?\d*)?\s*;?\s*$/i.exec(s.sql);
  if (!tail) return used;
  const at = tail[1] ? Number(tail[1]) - 1 : (s.sql.slice(0, tail.index).match(/\?(?!\d)/g) || []).length;
  const arg = /^([A-Z][A-Z0-9_]*)(?:\s*([+-])\s*(\d+))?$/.exec(s.binds[at] || '');
  const number = arg && NUMBERS.get(arg[1]);
  if (!number || number.size !== 1) return used;
  const n = Number([...number][0]) + (arg[2] === '-' ? -1 : 1) * Number(arg[3] || 0);
  return used.replace(/\bLIMIT\s+\S+((?:\s+OFFSET\s+\S+)?)\s*;?\s*$/i, `LIMIT ${n}$1`);
}

function statements(file) {
  const src = readFileSync(file, 'utf8');
  const out = [];
  for (let i = 0; i < src.length; i++) {
    if (src[i] === '/' && src[i + 1] === '*') { i = src.indexOf('*/', i + 2) + 1; if (i <= 0) break; continue; }
    if (src[i] === '/' && src[i + 1] === '/') { i = src.indexOf('\n', i); if (i < 0) break; continue; }
    const l = literal(src, i);
    if (!l) continue;
    let [text, k] = l;
    /* Tested whole as well as by its first piece: 'UPDATE ' + table + ' SET'
       is a statement only once it is joined. */
    if (!OPENS.test(text)) { i = k - 1; continue; }
    for (;;) {
      const m = /^\s*\+\s*/.exec(src.slice(k));
      if (!m) break;
      k += m[0].length;
      const next = literal(src, k);
      if (next) { text += next[0]; k = next[1]; continue; }
      const end = skipCode(src, k);
      const piece = src.slice(k, end).trim();
      const number = NUMBERS.get(piece);
      text += CONSTS.has(piece) ? CONSTS.get(piece) : number && number.size === 1 ? ` ${[...number][0]} ` : ' __X__ ';
      k = end;
    }
    if (STARTS.test(text)) out.push({ line: src.slice(0, i).split('\n').length, sql: text, ...chain(src, k) });
    i = k - 1;
  }
  return out;
}

/* What a placeholder may have been, tried in turn: a value, a comparison, a
   condition, nothing, a condition joined on — eatOnly()'s " AND kind = …".
   The first that SQLite accepts is the one read. */
const STAND_INS = ['?', '= ?', '1', '', 'AND 1'];

/* Every way the placeholders in one statement can be stood in for: all of
   them alike first, the way most statements read, then each its own, so a
   statement that splices a value in one place and a condition in another —
   `WHERE hidden = 0` + only + ` AND ` + DUE_SQL — is read too. Up to six
   placeholders, five to the sixth tries at most, and only for a statement
   none of the five alike could read. */
function* standIns(sql) {
  const n = (sql.match(/__X__/g) || []).length;
  for (const stand of STAND_INS) yield sql.replace(/__X__/g, stand);
  if (n < 2 || n > 6) return;
  const pick = new Array(n).fill(0);
  for (;;) {
    let i = 0;
    while (i < n && ++pick[i] === STAND_INS.length) pick[i++] = 0;
    if (i === n) return;
    let k = 0;
    yield sql.replace(/__X__/g, () => STAND_INS[pick[k++]]);
  }
}

const db = new DatabaseSync(':memory:');
db.exec(readFileSync(join(ROOT, 'db', 'schema.sql'), 'utf8'));
const TABLES = new Set(db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map((r) => r.name));

/* The first column of an index, or of a table's primary key — what a
   search with no constraint on it walks in the order of. */
function leading(table, index) {
  let name = index;
  if (!name) {
    const pk = db.prepare(`PRAGMA index_list("${table}")`).all().find((r) => r.origin === 'pk');
    if (!pk) return 'rowid';
    name = pk.name;
  }
  const cols = db.prepare(`PRAGMA index_info("${name}")`).all();
  return cols.length ? cols[0].name : null;
}

/* The site's tables a statement names, each by its own name and by the
   alias it was given, as the plan calls them. */
function aliases(sql) {
  const alias = new Map();
  for (const m of sql.matchAll(/\b(?:FROM|JOIN)\s+(\w+)(?:\s+(?:AS\s+)?(\w+))?/gi)) {
    if (TABLES.has(m[1])) { alias.set(m[1], m[1]); if (m[2]) alias.set(m[2], m[1]); }
  }
  return alias;
}

/* The tables a plan walks, by name or by the alias the statement gave
   them. Three shapes of plan walk a table:

     SCAN t                     every row
     SEARCH t USING … KEY       a key with nothing to seek by: from one end
                                to the other until the statement has its
                                answer — one row for MIN or MAX of the key's
                                first column, every row for anything else
                                (the counter's MIN(day) WHERE kind = 'shown')
     SEARCH t … (day<?)         a key limited only from above: every day
                                there has ever been, before that one
                                (the counter's `day < ?`)

   A range from below, `day>?`, is a recent span and costs that span, not
   the table; the author still says what the span costs. A scan of a
   subquery, a CTE or json_each is a scan of rows already chosen. */
function walked(plan, sql) {
  const alias = aliases(sql);
  const out = [];
  for (const { detail } of plan) {
    const scan = /^SCAN (\w+)/.exec(detail);
    if (scan) { if (alias.has(scan[1])) out.push(alias.get(scan[1])); continue; }
    const search = /^SEARCH (\w+) USING (?:COVERING )?(?:INDEX (\w+)|(?:INTEGER )?PRIMARY KEY)(?: \(([^)]*)\))?(?: LEFT-JOIN)?$/.exec(detail);
    if (!search || !alias.has(search[1])) continue;
    const table = alias.get(search[1]);
    const bound = search[3];
    const first = leading(table, search[2]);
    if (!bound) {
      const ends = /^\s*SELECT\s+(?:MIN|MAX)\((\w+)\)(?:\s+AS\s+\w+)?\s+FROM\s+\w+\s*$/i.exec(sql);
      if (!(ends && ends[1] === first)) out.push(table);
    } else if (/^\w+<=?\?$/.test(bound.trim())) {
      /* Below a bound is the past, unless the statement only wants its last
         row — MAX(week) WHERE week < ? reads one — or is deleting it, when
         the rows read are the rows that go. */
      const edge = new RegExp(`\\b(?:MIN|MAX)\\(\\s*${first}\\s*\\)`, 'i').test(sql);
      const tidy = /^\s*DELETE\b/i.test(sql);
      if (!edge && !tidy) out.push(table);
    }
  }
  return out;
}

/* ------------------------------------------------------------ the answer
 * How many rows a SELECT can answer with, which is the owner's second rule,
 * drawn on 19 November 2026: no query brings back more than a hundred, and
 * where more is genuinely needed it is paginated. A read is bounded when one
 * of four things says so from the statement and the code around it —
 *
 *   - a LIMIT of a hundred or less on the statement as a whole, written as a
 *     number, a constant that is one, or a `?` bound to one — limitOf();
 *   - its key: every table the outer query loops over is reached through a
 *     unique key with every column of it pinned by = or an IN list, so the
 *     answer is a row per value asked for;
 *   - one aggregate row: COUNT, SUM, MIN, MAX and their kind with no
 *     GROUP BY, or no FROM at all;
 *   - or the code asking for `.first()`, which answers one row whatever the
 *     statement could have.
 *
 * Anything else is in ROWS below with what bounds it, in numbers, or it
 * fails the build. */
const LIMIT = 100;

/* The statement with every string and everything inside brackets blanked,
   so what is left is the outer query alone: its own SELECT, FROM, GROUP BY
   and LIMIT, never a subquery's or a CTE's. */
function outer(sql) {
  let out = '';
  let depth = 0;
  for (let i = 0; i < sql.length; i++) {
    const c = sql[i];
    if (c === "'" || c === '"') {
      const end = sql.indexOf(c, i + 1);
      const stop = end < 0 ? sql.length : end;
      out += ' '.repeat(stop - i + 1);
      i = stop;
      continue;
    }
    if (c === '(') { if (!depth) out += c; else out += ' '; depth++; continue; }
    if (c === ')') { depth--; out += depth ? ' ' : c; continue; }
    out += depth ? ' ' : c;
  }
  return out;
}

/* Text with every bracketed subquery — `(SELECT …)` — blanked, and the
   rest as it was. */
function subqueriesBlanked(text) {
  let out = '';
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '(' && /^\(\s*SELECT\b/i.test(text.slice(i))) {
      let depth = 0;
      let j = i;
      for (; j < text.length; j++) { if (text[j] === '(') depth++; else if (text[j] === ')' && !--depth) break; }
      out += ' '.repeat(j - i + 1);
      i = j;
      continue;
    }
    out += text[i];
  }
  return out;
}

const AGGREGATE = /\b(?:COUNT|SUM|TOTAL|AVG|MIN|MAX|GROUP_CONCAT|JSON_GROUP_ARRAY|JSON_GROUP_OBJECT)\s*\(/i;

/* The columns of the index a search used — the table's primary key where
   it names none — or null where that index is not unique. */
function unique(table, index) {
  let name = index;
  if (!name) {
    const pk = db.prepare(`PRAGMA index_list("${table}")`).all().find((r) => r.origin === 'pk');
    if (!pk) return null;
    name = pk.name;
  }
  const row = db.prepare(`PRAGMA index_list("${table}")`).all().find((r) => r.name === name);
  if (!row || !row.unique) return null;
  return db.prepare(`PRAGMA index_info("${name}")`).all().map((r) => r.name);
}

/* Whether a SELECT answers a hundred rows or fewer, by its LIMIT, its key
   or its being one aggregate row. */
function bounded(sql, plan) {
  const top = outer(sql);
  const limit = /\bLIMIT\s+(\d+)\s*(?:OFFSET\s+\S+\s*)?;?\s*$/i.exec(top);
  if (limit) return Number(limit[1]) <= LIMIT;
  if (/\b(?:UNION|INTERSECT|EXCEPT)\b/i.test(top)) return false;
  const select = /\bSELECT\b([\s\S]*?)(?:\bFROM\b([\s\S]*))?$/i.exec(top);
  if (!select) return false;
  if (select[2] === undefined) return true;
  /* The select list as written, with its subqueries' own aggregates blanked
     — COALESCE(SUM(n), 0) is one row, (SELECT COUNT(*) …) per row is not. */
  const start = select.index + select[0].indexOf(select[1]);
  const said = sql.slice(start, start + select[1].length);
  if (!/\bGROUP\s+BY\b/i.test(select[2]) && !/\bOVER\b/i.test(said) && AGGREGATE.test(subqueriesBlanked(said))) return true;
  const tables = aliases(sql);
  const loops = plan.filter((r) => r.parent === 0 && /^(?:SCAN|SEARCH) /.test(r.detail));
  if (!loops.length) return false;
  for (const { detail } of loops) {
    const search = /^SEARCH (\w+) USING (?:COVERING )?(?:INDEX (\w+)|(INTEGER )?PRIMARY KEY) \(([^)]*)\)(?: LEFT-JOIN)?$/.exec(detail);
    if (!search || !tables.has(search[1])) return false;
    const pinned = new Set(search[4].split(' AND ').map((c) => /^(\w+)=\?$/.exec(c.trim())).filter(Boolean).map((m) => m[1]));
    const key = search[3] ? ['rowid'] : unique(tables.get(search[1]), search[2]);
    if (!key || !key.every((c) => pinned.has(c))) return false;
  }
  return true;
}

/* A probe for a column or a table: no WHERE, LIMIT 0 or 1, reads a row at
   most. */
const PROBE = /^\s*SELECT\s+[\w*., ]+\s+FROM\s+\w+\s+LIMIT\s+[01]\s*$/i;

/* A statement as one line, every run of space one space — how an entry's
   `has` is matched, whatever the code's line breaks and splices left. */
const squeeze = (sql) => sql.replace(/\s+/g, ' ').trim();

const failed = [];
const unread = [];
const over = [];
const toFix = [];
const matched = new Set();
let count = 0;
const FILES = modules(join(ROOT, 'functions'));
for (const file of FILES) constants(readFileSync(file, 'utf8'));
for (const file of FILES) {
  const rel = relative(join(ROOT, 'functions'), file).split(sep).join('/');
  for (const s of statements(file)) {
    count++;
    let plan = null;
    let used = '';
    let error = '';
    for (const tried of standIns(s.sql)) {
      try { plan = db.prepare('EXPLAIN QUERY PLAN ' + tried).all(); used = tried; break; } catch (e) { if (!error) error = e.message; }
    }
    const where = `functions/${rel}:${s.line}`;
    if (!plan) {
      const priced = UNREAD.find((u) => u.file === rel && squeeze(s.sql).includes(u.has));
      if (priced) { matched.add(priced); if (ALL) console.log(`priced ${where}\n    because ${priced.why}`); }
      else unread.push(`${where}  ${error}`);
      continue;
    }
    if (/^\s*(?:SELECT|WITH)\b/i.test(used) && !/\b(?:UPDATE|INSERT|DELETE|REPLACE)\b/i.test(outer(used)) &&
        !(s.first || bounded(limitOf(s, used), plan))) {
      const entry = ROWS.find((r) => r.file === rel && squeeze(used).includes(r.has));
      const line = `${where}\n    ${squeeze(used).slice(0, 200)}`;
      if (entry) matched.add(entry);
      if (entry && entry.fix) toFix.push(`${line}\n    ${entry.why} — ${entry.fix}`);
      else if (!entry && !rel.startsWith(ADMIN)) over.push(line);
      else if (ALL) console.log(`rows   ${line}\n    because ${entry ? entry.why : "the owner's page"}`);
    }
    if (PROBE.test(used)) continue;
    const tables = walked(plan, used);
    if (!tables.length) continue;
    const known = rel.startsWith(ADMIN)
      ? 'the owner\'s page'
      : (KNOWN.find((k) => k.file === rel && used.includes(k.has)) || {}).why;
    const line = `${where}  walks ${[...new Set(tables)].join(', ')}\n    ${squeeze(used).slice(0, 200)}`;
    if (!known) failed.push(line);
    else if (ALL) console.log(`known  ${line}\n    because ${known}`);
  }
}

const stale = [...ROWS, ...UNREAD].filter((e) => !matched.has(e));
if (ALL) for (const t of toFix) console.log(`to fix ${t}`);
for (const u of unread) console.log(`UNREAD ${u}`);
for (const o of over) console.log(`ROWS   ${o}`);
for (const e of stale) console.log(`STALE  functions/${e.file}  ${e.has}`);
for (const f of failed) console.log(`WALKS  ${f}`);
if (unread.length) console.log(`\n${unread.length} statement(s) could not be read. Make them readable, or price them by hand in UNREAD in tools/sqlcheck.mjs.`);
if (over.length) console.log(`\n${over.length} read(s) can answer more than ${LIMIT} rows. Give it a LIMIT of ${LIMIT} or less and page it, read it by its key, or add it to ROWS in tools/sqlcheck.mjs with what bounds it.`);
if (stale.length) console.log(`\n${stale.length} entr${stale.length === 1 ? 'y' : 'ies'} in ROWS or UNREAD match nothing any more. Take them out.`);
if (failed.length) console.log(`\n${failed.length} statement(s) read a whole table. Use the key, or add the statement to KNOWN in tools/sqlcheck.mjs with what bounds it.`);
if (unread.length || over.length || stale.length || failed.length) process.exit(1);
console.log(`sqlcheck: ${count} statements, none walks a table it was not meant to or answers more than ${LIMIT} rows unlisted${toFix.length ? `; ${toFix.length} to fix, which --all lists` : ''}.`);
