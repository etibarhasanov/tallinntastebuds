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
 * more than a placeholder can stand in for — is listed as unread, which is
 * a warning, never a failure.
 *
 * Usage:
 *
 *     node tools/sqlcheck.mjs          every statement; one line when all pass
 *     node tools/sqlcheck.mjs --all    every plan that walks, KNOWN included
 *
 * Exit 1 with a line per statement that walks a table and is not KNOWN.
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
  { file: 'api/venues.js', has: 'FROM google_venues', why: 'the directory is the whole roll; cached at the edge' },
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

const STARTS = /^\s*(SELECT\b|WITH\s+(RECURSIVE\s+)?\w+\s*(\(|AS\b)|UPDATE\s+\w+\s+SET\b|DELETE\s+FROM\b|INSERT\b|REPLACE\s+INTO\b)/i;

/* The upper-case constants that are a string and nothing else — AUTHOR in
   _posts.js, say — so a statement that splices one in is read with it
   rather than with a placeholder. One table for every file: the names are
   distinct, and an import reads the same text as the file that wrote it. */
const CONSTS = new Map();
function constants(src) {
  for (const m of src.matchAll(/\bconst\s+([A-Z][A-Z0-9_]*)\s*=\s*/g)) {
    let k = m.index + m[0].length;
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

function statements(file) {
  const src = readFileSync(file, 'utf8');
  const out = [];
  for (let i = 0; i < src.length; i++) {
    if (src[i] === '/' && src[i + 1] === '*') { i = src.indexOf('*/', i + 2) + 1; if (i <= 0) break; continue; }
    if (src[i] === '/' && src[i + 1] === '/') { i = src.indexOf('\n', i); if (i < 0) break; continue; }
    const l = literal(src, i);
    if (!l) continue;
    let [text, k] = l;
    if (!STARTS.test(text)) { i = k - 1; continue; }
    for (;;) {
      const m = /^\s*\+\s*/.exec(src.slice(k));
      if (!m) break;
      k += m[0].length;
      const next = literal(src, k);
      if (next) { text += next[0]; k = next[1]; continue; }
      const end = skipCode(src, k);
      const piece = src.slice(k, end).trim();
      text += CONSTS.has(piece) ? CONSTS.get(piece) : ' __X__ ';
      k = end;
    }
    out.push({ line: src.slice(0, i).split('\n').length, sql: text });
    i = k - 1;
  }
  return out;
}

/* What a placeholder may have been, tried in turn: a value, a comparison, a
   condition, nothing. The first that SQLite accepts is the one read. */
const STAND_INS = ['?', '= ?', '1', ''];

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
  const alias = new Map();
  for (const m of sql.matchAll(/\b(?:FROM|JOIN)\s+(\w+)(?:\s+(?:AS\s+)?(\w+))?/gi)) {
    if (TABLES.has(m[1])) { alias.set(m[1], m[1]); if (m[2]) alias.set(m[2], m[1]); }
  }
  const out = [];
  for (const { detail } of plan) {
    const scan = /^SCAN (\w+)/.exec(detail);
    if (scan) { if (alias.has(scan[1])) out.push(alias.get(scan[1])); continue; }
    const search = /^SEARCH (\w+) USING (?:COVERING )?(?:INDEX (\w+)|(?:INTEGER )?PRIMARY KEY)(?: \((.*)\))?$/.exec(detail);
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

/* A probe for a column or a table: no WHERE, LIMIT 0 or 1, reads a row at
   most. */
const PROBE = /^\s*SELECT\s+[\w*., ]+\s+FROM\s+\w+\s+LIMIT\s+[01]\s*$/i;

const failed = [];
const unread = [];
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
    for (const stand of STAND_INS) {
      used = s.sql.replace(/__X__/g, stand);
      try { plan = db.prepare('EXPLAIN QUERY PLAN ' + used).all(); break; } catch (e) { error = e.message; }
    }
    const where = `functions/${rel}:${s.line}`;
    if (!plan) { unread.push(`${where}  ${error}`); continue; }
    if (PROBE.test(used)) continue;
    const tables = walked(plan, used);
    if (!tables.length) continue;
    const known = rel.startsWith(ADMIN)
      ? 'the owner\'s page'
      : (KNOWN.find((k) => k.file === rel && used.includes(k.has)) || {}).why;
    const line = `${where}  walks ${[...new Set(tables)].join(', ')}\n    ${used.replace(/\s+/g, ' ').trim().slice(0, 200)}`;
    if (!known) failed.push(line);
    else if (ALL) console.log(`known  ${line}\n    because ${known}`);
  }
}

for (const u of unread) console.log(`unread ${u}`);
if (failed.length) {
  for (const f of failed) console.log(`WALKS  ${f}`);
  console.log(`\n${failed.length} statement(s) read a whole table. Use the key, or add the statement to KNOWN in tools/sqlcheck.mjs with what bounds it.`);
  process.exit(1);
}
console.log(`sqlcheck: ${count} statements, none walks a table it was not meant to${unread.length ? `, ${unread.length} not read` : ''}.`);
