#!/usr/bin/env node
/**
 * Tallinn Tastebuds — a write to D1 is the owner's decision, not a session's,
 * and a read is priced before it runs.
 *
 * A PreToolUse hook wired in .claude/settings.json to every door a session
 * has into D1 — the Cloudflare MCP tool `d1_database_query`, any other MCP
 * tool that names D1 or Cloudflare, and the shell, for `wrangler d1` and
 * curl to D1's API; EVERY DOOR, NOT ONE TOOL below says how each is read. It
 * reads the call on stdin and answers with one of three permission
 * decisions, or with no word for a call that does not reach D1:
 *
 *   allow   the SQL is read-only — SELECT, a CTE that only selects, EXPLAIN,
 *           or a PRAGMA being asked rather than set — and by the planner's
 *           account it reads READ_MAX rows or fewer. Checking the state of a
 *           table is how any of this gets verified, and a prompt per SELECT
 *           would mean a dozen prompts to answer one question.
 *   ask     a read priced past READ_MAX, one this cannot price, or any read
 *           once the day's hand-run reads have passed DAY_MAX or one of them
 *           came back dearer than READ_MAX — A READ HAS A PRICE below.
 *   ask     a write that names its rows and names at most a hundred of them.
 *           The prompt carries the database, the count and the statements, so
 *           what is about to be written is on the screen before the yes, and
 *           it says so twice over twenty.
 *   deny    a write too big to be one decision (over a hundred rows), a write
 *           whose size is not in the statement at all (`WHERE cuisine =
 *           'American'`, a LIKE, a subquery), and DROP, which the owner has
 *           said is never run here. Denied is not a prompt: the SQL has to
 *           change, or the file goes through `wrangler d1 execute` in a
 *           terminal, where the person running it is the person deciding.
 *
 * WHY THIS EXISTS AND NOT JUST A LINE IN A CHECKLIST
 *
 * Because a checklist is a thing a session can decide it has already
 * satisfied. In September 2026 a session with the export in front of it and
 * a fix that plainly wanted loading wrote the cuisine column of 74 rows into
 * both databases, production included, having asked nobody: it had been told
 * "merge it", it reasoned the load was part of landing the merge, and it was
 * wrong about whose call that was. The rows were right and the reasoning was
 * not the point. So the gate is machinery now. A hook runs before the tool
 * does, cannot be talked round, and puts the decision where it belongs.
 *
 * WHY IT DECIDES "allow" RATHER THAN STAYING SILENT ON READS
 *
 * The tool is deliberately NOT in `permissions.allow` any more. If it were,
 * the allow rule would be the thing answering for every call and this hook
 * would be decoration. So the hook is the whole answer for this tool: it
 * hands back `allow` for the read-only calls and stops the rest, and removing
 * it from settings.json puts every call back behind a prompt, which is the
 * right way to fail.
 *
 * FAIL CLOSED, ALWAYS
 *
 * Unparseable JSON, SQL it cannot classify, a statement it has no word for —
 * all of it stops, as `ask` where the shape is merely unreadable and as `deny`
 * where a row count should have been legible and was not. The cost of a wrong
 * `ask` is one keystroke and the cost of a wrong `deny` is a sentence saying
 * so. The cost of a wrong `allow` is somebody else's rows.
 *
 * RATTATEE RUNS THIS FILE TOO
 *
 * The Cloudflare connector is the account's, so a session on
 * etibarhasanov/rattatee reaches the same databases. Its
 * `.claude/hooks/d1-gate.mjs` runs this file, from this checkout's root, when
 * the two sit side by side, and asks about every query when they do not. A
 * change here is a change there; the answer it hands back is this one's.
 *
 * THE SAME FILE RUNS AFTER THE QUERY, AS `--after`
 *
 * A PostToolUse hook on the same tool, which reads what the query really
 * cost out of its answer and keeps the day's total — THE METER below. One
 * file, so the two numbers that bound a read are written once.
 *
 * Zero dependencies, like every other tool in this repository, and it runs
 * from whatever directory Claude Code starts it in — the database names come
 * from wrangler.toml when it can be found, and the raw id is printed when it
 * cannot, so a moved file makes the message vaguer and never makes the gate
 * weaker.
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

/* Statements that only read. Everything outside this list — INSERT, UPDATE,
   DELETE, REPLACE, CREATE, DROP, ALTER, ATTACH, VACUUM, BEGIN, a PRAGMA with
   a value, a word this does not know — takes the ask branch below. */
const READ_ONLY = /^(select|explain)\b/;
/* A CTE reads only while nothing in it writes. SQLite allows
   `WITH x AS (...) INSERT INTO ...`, and the write word can be anywhere after
   the WITH, so the whole statement is searched rather than just its head. */
const WRITES = /\b(insert|update|delete|replace|create|drop|alter|truncate|attach|detach|vacuum|reindex|begin|commit|rollback|savepoint|release)\b/;
/* `PRAGMA foreign_keys` asks; `PRAGMA foreign_keys = ON` sets. */
const PRAGMA_READ = /^pragma\s+[a-z_0-9.]+\s*(\(\s*[^)]*\s*\))?\s*$/;

/* Comments and string literals come out before any of the above is applied:
   a café called "Update" is not a write, and `-- drop this later` is not
   either. Each becomes a space, so two words never run together.
 *
 * WHY THIS IS A SCANNER AND NOT FOUR REPLACE() CALLS
 *
 * Because the two kinds of hiding place nest, and a chain of regular
 * expressions has to pick which one it believes first — and either order can
 * be walked through. This file's first version stripped comments first, and
 * `SELECT 'it--s'; UPDATE …` lost everything from the apostrophe's `--` to
 * the end of the line, the UPDATE included: what was left read as a plain
 * SELECT and would have been allowed. Stripping literals first instead only
 * moves the hole — an apostrophe inside a `--` comment then opens a literal
 * that swallows the statement after it. Both shapes are in CASES below.
 *
 * One pass, one state, no precedence to get wrong: a quote inside a comment is
 * comment text, a comment marker inside a literal is literal text, and the
 * doubled '' and "" that escape a quote in SQL keep the literal open. */
function stripped(sql) {
  const src = String(sql);
  let out = '';
  let i = 0;
  while (i < src.length) {
    const two = src.slice(i, i + 2);
    if (two === '--') {
      const end = src.indexOf('\n', i);
      out += ' ';
      i = end === -1 ? src.length : end + 1;
    } else if (two === '/*') {
      const end = src.indexOf('*/', i + 2);
      out += ' ';
      i = end === -1 ? src.length : end + 2;
    } else if (src[i] === "'" || src[i] === '"') {
      const quote = src[i];
      i++;
      while (i < src.length) {
        if (src[i] === quote) {
          /* A doubled quote is one quote of content, not the end. */
          if (src[i + 1] === quote) i += 2;
          else { i++; break; }
        } else i++;
      }
      out += quote === "'" ? " '' " : ' "" ';
    } else {
      out += src[i];
      i++;
    }
  }
  return out.replace(/\s+/g, ' ').trim().toLowerCase();
}

/* One SQL string into statements. Semicolons inside literals are already gone
   by the time this runs, which is why it can be this simple. */
function statements(sql) {
  return stripped(sql)
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean);
}

function readsOnly(sql) {
  const parts = statements(sql);
  if (!parts.length) return false;
  return parts.every((part) => {
    if (WRITES.test(part)) return false;
    if (READ_ONLY.test(part)) return true;
    if (part.startsWith('with ')) return /\bselect\b/.test(part);
    if (part.startsWith('pragma')) return PRAGMA_READ.test(part);
    return false;
  });
}

/* Which database, in the words wrangler.toml uses for it, because "production"
   and "preview" are what a person deciding needs to see — an id is thirty-six
   characters that all look alike. */
function databaseName(id, root) {
  if (!id) return 'an unnamed database';
  try {
    const toml = readFileSync(`${root}/wrangler.toml`, 'utf8');
    const names = [...toml.matchAll(/database_name\s*=\s*"([^"]+)"[\s\S]*?database_id\s*=\s*"([^"]+)"/g)];
    for (const [, name, dbId] of names) if (dbId === id) return name;
  } catch (e) {
    /* Not in the project directory, or no wrangler.toml yet. The id still
       identifies the database; only the friendly name is lost. */
  }
  return id;
}

/* HOW MANY ROWS, AND THE TWO NUMBERS THAT BOUND IT
 *
 * The owner's rule: a write names at most a hundred rows, and twenty is the
 * size an ordinary one should be. Twenty is a correction somebody could have
 * typed; a hundred is the point where nobody is reading the list any more and
 * it wants a terminal, a file and `wrangler d1 execute` rather than a session
 * and a prompt.
 *
 * A cap is only worth having if the count is knowable before the statement
 * runs, so the gate does not estimate — it insists the SQL say. A write it can
 * count is one that names its rows: an INSERT with its tuples written out, or
 * an UPDATE or DELETE whose WHERE pins every primary-key column of the table
 * with `=` or `IN (…)`. The keys come from db/schema.sql, parsed at the moment
 * of asking, so a new table is covered the day it is added.
 *
 * Anything else — `WHERE cuisine = 'American'`, a LIKE, a range, a subquery, a
 * table this cannot find — is refused rather than guessed at, because those
 * are exactly the writes whose size nobody knows until afterwards. That is
 * strict on purpose and the way out is not to argue with it: name the rows, or
 * run the file from a terminal, which is what the two wrangler lines in the
 * skills have always been for.
 */
const SOFT_MAX = 20;
const HARD_MAX = 100;
/* Writes that change the database's shape rather than a number of rows. The
   cap has nothing to say about these; they ask like anything else. DROP is not
   among them — see below, it is refused outright. */
const SHAPE = /^(create|alter|reindex|analyze|vacuum|attach|detach|pragma|begin|commit|rollback|savepoint|release)\b/;

/* table -> its primary-key columns, out of db/schema.sql. Both shapes the
   schema uses: `place_id TEXT PRIMARY KEY` on the column, and a table-level
   `PRIMARY KEY (list_id, place_id)` for the six composite ones. */
function primaryKeys(root) {
  const keys = new Map();
  let schema;
  try {
    schema = readFileSync(`${root}/db/schema.sql`, 'utf8');
  } catch (e) {
    return keys;
  }
  /* db/schema.sql is nine parts prose to one part SQL and the prose says
     "primary key" in sentences — "It is the primary key because it is the only
     identifier here that Google guarantees" once read as a column called `is`.
     So the comments come off before anything is matched. */
  const sql = schema.replace(/--[^\n]*/g, '');
  /* A table ends at the `)` that opens its own line, and whatever follows it
     up to the semicolon — `WITHOUT ROWID` on three of them. Matching only a
     bare `);` there read past visitor_counts into the next three tables, so
     users, visitor_live and flow_counts had no key and every write to them
     was refused however few rows it named. */
  const tables = sql.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?([a-z_0-9]+)\s*\(([\s\S]*?)\n\)[^;\n]*;/gi);
  for (const [, table, body] of tables) {
    const composite = body.match(/\bprimary\s+key\s*\(([^)]+)\)/i);
    if (composite) {
      keys.set(table.toLowerCase(), composite[1].split(',').map((c) => c.trim().toLowerCase()));
      continue;
    }
    /* A column line, not a phrase: name, type, then PRIMARY KEY before the
       comma that ends it. */
    const single = body.match(/^\s*([a-z_0-9]+)\s+(?:text|integer|real|blob|numeric)\b[^,]*?\bprimary\s+key/im);
    if (single) keys.set(table.toLowerCase(), [single[1].toLowerCase()]);
  }
  return keys;
}

/* Literals in a stripped statement are `''` (see stripped()) or bare numbers,
   which is what makes them countable at all. */
function literals(text) {
  return (text.match(/''|""|\b\d+(\.\d+)?\b/g) || []).length;
}

/* An upper bound on the rows one statement touches, or null for "this cannot
   be counted", which is the same as too many. */
function rowsTouched(part, keys) {
  const insert = part.match(/^(?:insert|replace)\s+(?:or\s+\w+\s+)?into\s+([a-z_0-9]+)/);
  if (insert) {
    const at = part.indexOf(' values ');
    /* INSERT … SELECT has no tuples to count and no bound this can offer. */
    if (at === -1) return null;
    /* The upsert's own `(place_id)` is not a row, so the count stops where the
       tuples do. */
    const rest = part.slice(at + 8).split(' on conflict')[0].split(' returning')[0];
    let depth = 0;
    let tuples = 0;
    for (const ch of rest) {
      if (ch === '(') { if (depth === 0) tuples++; depth++; }
      else if (ch === ')') depth--;
    }
    return tuples || null;
  }

  const change = part.match(/^(?:update|delete\s+from)\s+([a-z_0-9]+)/) ||
                 part.match(/^update\s+([a-z_0-9]+)/);
  if (!change) return null;
  const table = (part.startsWith('update') ? part.match(/^update\s+([a-z_0-9]+)/) : change)[1];
  const columns = keys.get(table);
  if (!columns) return null;

  const at = part.search(/\bwhere\b/);
  if (at === -1) return null;
  const clause = part.slice(at + 5);

  /* Every key column has to be pinned. One left free is a sweep of everything
     that shares the others, and its size is not in the statement. */
  let bound = 1;
  for (const column of columns) {
    const inList = clause.match(new RegExp(`\\b${column}\\s+in\\s*\\(([^)]*)\\)`));
    if (inList) { bound *= literals(inList[1]) || 0; continue; }
    const equals = clause.match(new RegExp(`\\b${column}\\s*=\\s*(''|""|\\d+)`));
    if (equals) continue;
    return null;
  }
  return bound || null;
}

/* A READ HAS A PRICE, AND IT IS WORKED OUT BEFORE THE READ IS RUN
 *
 * D1 bills the rows a statement walks, and the free plan stops every read on
 * the account at five million a day. On 2026-11-18 a session answering "how
 * long did I wait at each stop" joined the points of each ride to themselves
 * — json_each against json_each, no key between them — and that one
 * statement read 6,602,979 rows out of a table of fifteen. The same question
 * walked once, with LAG(), read 29,228. Nothing stood in front of either:
 * a read was a read and ran.
 *
 * The owner's rule since: no hand-run read brings more than READ_MAX rows.
 * So a read is priced the way tools/sqlcheck.mjs prices the Functions' — an
 * empty database built from db/schema.sql, SQLite's own EXPLAIN QUERY PLAN —
 * and the plan is turned into rows with the sizes in SIZES:
 *
 *   SCAN t                 the whole table, SIZES[t]
 *   SEARCH t … (a=?)       one row where every primary-key column is pinned,
 *                          SEEK where an index is only entered by its front,
 *                          and the whole table where the bound is a range —
 *                          `day >= ?` is every day since
 *   SCAN … VIRTUAL TABLE   json_each and its kind, UNPACKED rows a time: a
 *                          ride's line is a thousand points
 *   one inside another     multiplied, which is the whole of what went wrong
 *
 * It is an estimate and errs dear: a range is priced as the table, and a
 * subquery's answer as everything it read. What that costs is a prompt, and
 * the prompt carries the number. What the estimate cannot see — a table that
 * grew past its line in SIZES, a search that filters behind its key — the
 * meter sees afterwards, and one read that comes back past READ_MAX makes
 * every read after it ask until midnight UTC.
 *
 * A read this cannot price asks: a table with no size here, a statement the
 * planner will not take, a Node without node:sqlite (before 22.5). Fail
 * closed, as with a write.
 */
const READ_MAX = 2000;
/* Ten reads at the ceiling: 0.4% of the day's five million. Past it a read
   is still possible, and is the owner's to allow. */
const DAY_MAX = 20000;
const UNPACKED = 1000;
const SEEK = 100;

/* Rows in each table of production, 2026-11-18. MAX(rowid) for a table with
   one, which reads a row a table — forty-one for the lot:
 *
 *   SELECT (SELECT MAX(rowid) FROM saves) saves, (SELECT MAX(rowid) FROM …
 *
 * and for the tables WITHOUT ROWID only where the number is written down
 * elsewhere. A table missing here has no price, so a walk of it asks; add
 * the line when one is measured. A table that has grown past its line is
 * caught by the meter, which is the day to measure it again. */
const SIZES = {
  saves: 62, save_counts: 39, press_counts: 715, profile_counts: 305, view_seen: 426,
  list_counts: 117, counter_days: 51, counter_total: 1, users: 81, username_holds: 3,
  profile_rows: 81, sessions: 105, login_fails: 21, identities: 49, lists: 39,
  list_items: 451, list_keeps: 8, added_places: 10, google_venues: 1177, google_calls: 55,
  google_refreshes: 717, google_reranks: 6, google_ranks: 6639, google_scores: 1209,
  feedback: 2, feedback_hearts: 2, meta: 1, flashcard_decks: 1, flashcard_cards: 170,
  flashcard_known: 3956, flashcard_reports: 4, posts: 1, post_texts: 4, walks: 5,
  walk_checks: 9,
  rides: 65, ride_sections: 6291, usage_people: 37, flashcard_days: 15,
  /* Its ceiling rather than a measure: twelve ordered pairs of the four
     CITIES, MIDDLES (three) each — LONG RIDES in functions/api/route.js. */
  route_middles: 36,
  /* Made in production on 2026-11-22 and filled by hand the same day: a
     ride a row and an account a row — A RIDE IN NUMBERS in
     functions/api/rides.js. */
  ride_stats: 37, ride_totals: 2,
  /* Made and filled on 2026-11-27, the day rides and ride_sections above
     were measured again. */
  ride_blocks: 1390,
  /* WITHOUT ROWID: the counter's table on the day it stopped the site, and a
     ring that is sixty rows for ever. */
  visitor_counts: 18439, visitor_live: 60,
  /* WITHOUT ROWID too, counted by hand on 2026-11-18 at 22:51 UTC. flow_counts
     is keyed (flow, day, who, id), so a question by day walks all of it — on
     2026-11-18 one asked it once per day of visitor_counts, 54,000 rows a
     run, fourteen times, before this line existed to price it. read_meter is
     a row a day and table. */
  flow_counts: 14238, read_meter: 21,
  /* WITHOUT ROWID, and not in production until db/schema.sql is run again:
     a row a person and deck, which were 148 pairs on 2026-11-19. */
  flashcard_progress: 148,
  /* Not in production: nothing loads db/city-venues.sql there yet. Priced as
     the three cities' export would be when it is, rather than left unpriced. */
  city_venues: 5000,
  /* The schema's own list of tables and indexes. */
  sqlite_master: 200, sqlite_schema: 200
};

/* An empty copy of the schema to ask the planner, or null where this Node
   has no SQLite or the schema cannot be read. Built once a run. */
let planner;
async function plannerFor(root) {
  if (planner !== undefined) return planner;
  planner = null;
  const emit = process.emitWarning;
  try {
    /* node:sqlite says it is experimental on every import, on stderr, where
       a hook's answer is read from. */
    process.emitWarning = () => {};
    const { DatabaseSync } = await import('node:sqlite');
    const db = new DatabaseSync(':memory:');
    db.exec(readFileSync(`${root}/db/schema.sql`, 'utf8'));
    planner = db;
  } catch (e) {
    /* Priced as unknown, which asks. */
  } finally {
    process.emitWarning = emit;
  }
  return planner;
}

/* The name a plan calls each table by: its own, or the alias the statement
   gave it. A word after a table that is SQL's and not an alias is neither. */
const NOT_ALIAS = /^(where|on|join|left|inner|cross|natural|group|order|limit|union|using|window|having|as)$/;
function aliases(part) {
  const names = new Map();
  for (const [, table, alias] of part.matchAll(/(?:\bfrom|\bjoin|,)\s+([a-z_0-9]+)(?:\s+(?:as\s+)?([a-z_0-9]+))?/g)) {
    if (!(table in SIZES) && !tablesKnown.has(table)) continue;
    names.set(table, table);
    if (alias && !NOT_ALIAS.test(alias)) names.set(alias, table);
  }
  return names;
}
/* Every table the schema has, so one with no line in SIZES is told from a
   subquery's name: the first has no price, the second is rows already read. */
let tablesKnown = new Set();

/* What one statement would read, by its plan: a number, Infinity where a
   table it walks has no size — `unsized` then names it — or null where the
   planner would not take it. */
function priceOf(db, part, keys) {
  let plan;
  try {
    plan = db.prepare(`EXPLAIN QUERY PLAN ${part}`).all();
  } catch (e) {
    return { rows: null, why: e.message };
  }
  const names = aliases(part);
  const under = new Map();
  for (const node of plan) under.set(node.parent, (under.get(node.parent) || []).concat(node));
  const made = new Map();
  let unsized = '';

  const sized = (table) => {
    if (table in SIZES) return Math.max(SIZES[table], 1);
    unsized = table;
    return Infinity;
  };
  const searched = (table, how) => {
    const bound = /\(([^()]*)\)\s*$/.exec(how);
    /* Nothing to seek by: one end of the key for a bare MIN or MAX, and
       from one end to the other for anything with a WHERE behind it. */
    if (!bound) return / where /.test(part) ? sized(table) : 1;
    const terms = bound[1].split(' AND ');
    if (terms.some((term) => /[<>]/.test(term))) return sized(table);
    const whole = /PRIMARY KEY/.test(how) && terms.length >= (keys.get(table) || ['rowid']).length;
    return whole ? 1 : Math.min(SEEK, table in SIZES ? sized(table) : SEEK);
  };
  /* A lone walk with a LIMIT and nothing to filter, sort or add up stops
     where the LIMIT does. */
  const peek = plan.length === 1 && !/ where |\b(count|sum|avg|min|max|total|group_concat)\s*\(/.test(part)
    ? / limit (\d+)(?: offset \d+)?$/.exec(part)
    : null;

  /* Nothing, however many times, is nothing — and not what Infinity times
     nought comes to, which would read as a statement with no price to pay. */
  const times = (loops, each) => (each ? loops * each : 0);
  /* `loops` is how many times the next thing down runs; `rows` what has
     been read. A loop inside a loop multiplies, a subquery beside one adds. */
  const walk = (parent) => {
    let loops = 1;
    let rows = 0;
    let looped = false;
    let out = 0;
    for (const node of under.get(parent) || []) {
      const step = /^(SCAN|SEARCH) (\S+)(.*)$/.exec(node.detail);
      if (step) {
        const [, kind, name, how] = step;
        let each;
        if (name === 'CONSTANT') each = 1;
        else if (/VIRTUAL TABLE/.test(how)) each = UNPACKED;
        else if (names.has(name)) each = kind === 'SCAN' ? sized(names.get(name)) : searched(names.get(name), how);
        else each = made.get(name) || UNPACKED;
        if (peek) each = Math.min(each, Number(peek[1]) || 1);
        /* A subquery's rows were counted where it was made. */
        if (/VIRTUAL TABLE/.test(how) || names.has(name)) rows += loops * each;
        loops *= each;
        looped = true;
        rows += times(loops, walk(node.id).rows);
      } else if (/^CORRELATED/.test(node.detail)) {
        rows += times(loops, walk(node.id).rows);
      } else {
        const inner = walk(node.id);
        rows += inner.rows;
        out += inner.loops;
        const name = /^(?:MATERIALIZE|CO-ROUTINE) (\S+)/.exec(node.detail);
        if (name) made.set(name[1], inner.loops);
      }
    }
    return { rows, loops: looped ? loops : Math.max(out, 1) };
  };
  return { rows: walk(0).rows, unsized };
}

/* The whole call priced: [rows, sentence]. Rows is null where there is no
   price to give, and the sentence says why. */
async function price(parts, root, keys) {
  const asked = parts.filter((part) => /^(select|with)\b/.test(part));
  if (!asked.length) return [0, ''];
  const db = await plannerFor(root);
  if (!db) return [null, 'this Node has no node:sqlite (22.5 or later) or db/schema.sql could not be read'];
  tablesKnown = new Set(db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map((row) => row.name));
  let rows = 0;
  for (const part of asked) {
    const one = priceOf(db, part, keys);
    if (one.rows === null) return [null, `the planner would not take it (${one.why})`];
    if (!Number.isFinite(one.rows)) return [null, `it walks ${one.unsized}, which has no size in SIZES in .claude/hooks/d1-write-gate.mjs`];
    rows += one.rows;
  }
  return [Math.round(rows), ''];
}

/* THE METER
 *
 * What the reads run by hand have really cost today, in .wrangler/ beside
 * the dev server's own scratch — ignored by git, and gone with the machine,
 * which in a cloud session is the session. `over` is every call that came
 * back past READ_MAX: the estimate was wrong about it, so the estimate is
 * not trusted again until the day turns.
 *
 * It counts this tool's reads and nothing else. The site's own are in
 * read_meter, the terminal's are nowhere, and the bill is Cloudflare's
 * dashboard: D1, the database, Metrics, Row Metrics.
 */
const today = () => new Date().toISOString().slice(0, 10);
const ledgerPath = (root) => `${root}/.wrangler/d1-reads.json`;
function ledger(root) {
  try {
    const kept = JSON.parse(readFileSync(ledgerPath(root), 'utf8'));
    if (kept && kept.day === today()) return kept;
  } catch (e) {
    /* No reads yet today, or none that were written down. */
  }
  return { day: today(), rows: 0, calls: 0, over: [] };
}

/* After the query: add what it read, and say so where it was too much. The
   answer is searched as text because the tool has wrapped it differently
   from one version to the next, and `rows_read` is the one name D1 gives. */
function meter(input) {
  const root = (input && (input.cwd || input.project_dir)) || process.cwd();
  const text = JSON.stringify((input && input.tool_response) || '');
  const rows = [...text.matchAll(/rows_read\\*"\s*:\s*(\d+)/g)].reduce((sum, m) => sum + Number(m[1]), 0);
  const kept = ledger(root);
  kept.rows += rows;
  kept.calls += 1;
  if (rows > READ_MAX) kept.over.push(rows);
  try {
    mkdirSync(`${root}/.wrangler`, { recursive: true });
    writeFileSync(ledgerPath(root), JSON.stringify(kept));
  } catch (e) {
    /* A total that cannot be kept is a meter that under-reads, not a query
       that failed. */
  }
  if (rows <= READ_MAX) return;
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PostToolUse',
      additionalContext:
        `That query read ${rows.toLocaleString('en')} rows, and no hand-run read is to bring more than ` +
        `${READ_MAX.toLocaleString('en')}. Tell the owner now, with the number. Every read asks until midnight UTC; ` +
        'before the next one, say what made this one dear and how the next is bounded.'
    }
  }));
}

/* The decision and the sentence that goes with it, kept apart from stdin so
   --check below can ask the same question of a table of SQL. */
async function verdict(sql, where, root = process.cwd(), kept = { rows: 0, over: [] }) {
  const parts = statements(sql);
  if (!parts.length) {
    return ['ask', `Nothing here reads as SQL, so the gate is asking rather than guessing. Target: ${where}.`];
  }
  if (readsOnly(sql)) {
    const [rows, why] = await price(parts, root, primaryKeys(root));
    const limit = `no hand-run read is to bring more than ${READ_MAX.toLocaleString('en')}`;
    if (rows === null) {
      return ['ask', `This read of ${where} has no price: ${why}. Run it if its size is known some other way; ${limit}.`];
    }
    /* EXPLAIN and a PRAGMA read nothing, and are how a dear read is looked
       into, so neither is held up by the day's total. */
    if (!rows) return ['allow', `Read-only query against ${where}, which reads no rows.`];
    const about = `about ${rows.toLocaleString('en')} rows by the planner's account`;
    if (rows > READ_MAX) {
      return ['ask', `This read of ${where} would walk ${about}, and ${limit}. Use a key, name the days, or walk the rows once instead of joining them to themselves.`];
    }
    if (kept.over.length) {
      return ['ask', `A read earlier today came back at ${Math.max(...kept.over).toLocaleString('en')} rows, past the ${READ_MAX.toLocaleString('en')} it was priced under, so every read of ${where} asks until midnight UTC. This one: ${about}.`];
    }
    if (kept.rows + rows > DAY_MAX) {
      return ['ask', `Reads run by hand have read ${kept.rows.toLocaleString('en')} rows today, and ${DAY_MAX.toLocaleString('en')} is where they start asking. This one of ${where}: ${about}.`];
    }
    return ['allow', `Read-only query against ${where}, ${about}.`];
  }

  const heads = parts.map((part) => part.split(' ').slice(0, 6).join(' '));
  const listed = `Statements: ${heads.join(' | ')}.`;

  /* The owner's standing instruction, and the one thing here that is not a
     matter of asking nicely. */
  if (parts.some((part) => /^drop\b/.test(part))) {
    return ['deny', `DROP is never run against ${where}. The tables are not to be dropped and there is no backup. ${listed}`];
  }

  /* Three kinds of write. One changes rows and says how many, one changes the
     shape of the database and has no row count to cap, and one is a write this
     cannot read as either — `WITH … DELETE`, say — which is the uncountable
     branch below rather than a shape. */
  const rowShaped = parts.filter((part) => /^(insert|replace|update|delete)\b/.test(part));
  const shape = parts.filter((part) => SHAPE.test(part));
  if (!rowShaped.length && shape.length === parts.length) {
    return ['ask', `This changes the shape of ${where} rather than a count of rows. ${listed}`];
  }

  const keys = primaryKeys(root);
  const counts = parts
    .filter((part) => !SHAPE.test(part))
    .map((part) => (/^(insert|replace|update|delete)\b/.test(part) ? rowsTouched(part, keys) : null));
  if (counts.some((count) => count === null)) {
    return ['deny',
      `The gate cannot tell how many rows this touches in ${where}, so it will not run: a write has to ` +
      'name its rows — an INSERT with its tuples written out, or a WHERE that pins every primary-key ' +
      'column with = or IN (…). Name them and ask again, or run the file from a terminal with ' +
      `wrangler d1 execute, which is what the skills' two lines are for. ${listed}`];
  }

  const rows = counts.reduce((sum, count) => sum + count, 0);
  if (rows > HARD_MAX) {
    return ['deny',
      `${rows} rows, and no write here may name more than ${HARD_MAX} at once — that is the owner's rule, ` +
      `and ${SOFT_MAX} is the size an ordinary correction should be. Split it, or run the whole file from ` +
      `a terminal with wrangler d1 execute where the count is somebody's decision rather than a prompt's. ${listed}`];
  }

  const size = rows > SOFT_MAX
    ? `${rows} rows — over the ${SOFT_MAX} an ordinary write should be, under the ${HARD_MAX} it may never pass, so read the list twice`
    : `${rows} row${rows === 1 ? '' : 's'}`;
  return ['ask',
    `This writes ${size} to ${where}. Changing rows is the owner's call, not the session's: check that ` +
    `the rows and columns named above are the ones you mean to change. ${listed}`];
}

/* EVERY DOOR, NOT ONE TOOL
 *
 * The gate began as a hook on one tool, `d1_database_query`, and on
 * 2026-11-19 that was found to be one door of several. The same rows answer
 * a `wrangler d1 execute --remote` typed into a shell, a curl to Cloudflare's
 * D1 API, and a tool of another Cloudflare MCP server — the newer API server
 * at mcp.cloudflare.com runs any call to the account. So the hook is wired to
 * Bash and to every MCP tool whose name says D1 or Cloudflare, and decide()
 * below reads each kind of call down to the SQL it would run, then hands that
 * to verdict() as if it had come through the one tool. What it cannot read
 * down to SQL asks; what restores, imports or deletes a database is refused.
 *
 *   d1_database_query, or any tool with d1 in its name and a `sql`, `query`
 *     or `command`         priced and decided as ever
 *   a D1 tool that deletes, drops, restores or imports
 *                          deny: a database is not dropped from here
 *   any other D1 tool that queries, executes or exports
 *                          ask: there is no SQL to price
 *   another tool whose input names D1's API
 *                          ask, or deny where it restores
 *   wrangler d1 execute --remote --command "…" or --file f
 *                          the SQL, or the file's, priced and decided
 *   wrangler d1 execute with neither --remote nor --local
 *                          ask: which database it reaches has changed
 *                          between wrangler versions
 *   wrangler d1 migrations apply --remote, export --remote
 *                          ask: a change of shape, and every row of a table
 *   wrangler d1 time-travel restore, wrangler d1 delete
 *                          deny
 *   curl or anything else naming api.cloudflare.com's /d1/
 *                          ask, or deny where it restores
 *   --local, and anything that is not D1 at all
 *                          no word: the ordinary permissions decide
 *
 * A shell command is never answered `allow`. The hook's allow would let the
 * whole line through, and the part after `&&` is not the gate's to wave on —
 * so a cheap read through wrangler gets no word and the usual permissions
 * decide it, while a dear one still asks and a refused one is still refused.
 */
const RANK = { allow: 0, ask: 1, deny: 2 };

/* A shell line into commands of words: quotes kept together and taken off,
   a backslash escaping the next character, and ; & | and newlines ending a
   command. Not a shell — a reader good enough to find `wrangler d1` and its
   flags, with the raw line searched as well below for whatever it misses. */
function shellCommands(line) {
  const commands = [];
  let words = [];
  let word = null;
  const push = () => { if (word !== null) words.push(word); word = null; };
  const end = () => { push(); if (words.length) commands.push(words); words = []; };
  const src = String(line || '');
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (c === "'") {
      const close = src.indexOf("'", i + 1);
      word = (word || '') + src.slice(i + 1, close === -1 ? src.length : close);
      i = close === -1 ? src.length : close;
    } else if (c === '"') {
      let j = i + 1;
      let text = '';
      while (j < src.length && src[j] !== '"') {
        if (src[j] === '\\' && j + 1 < src.length) { text += src[j + 1]; j += 2; } else { text += src[j]; j++; }
      }
      word = (word || '') + text;
      i = j;
    } else if (c === '\\' && i + 1 < src.length) {
      if (src[i + 1] !== '\n') word = (word || '') + src[i + 1];
      i++;
    } else if (c === ';' || c === '&' || c === '|' || c === '\n') {
      end();
    } else if (/\s/.test(c)) {
      push();
    } else {
      word = (word || '') + c;
    }
  }
  end();
  /* `bash -c '…'` and its kin: the quoted line is a line of its own. */
  const inner = [];
  for (const cmd of commands) {
    for (let k = 0; k < cmd.length - 1; k++) {
      if (/^(ba|z|da)?sh$/.test(cmd[k].split('/').pop()) && cmd[k + 1] === '-c' && cmd[k + 2]) {
        inner.push(...shellCommands(cmd[k + 2]));
      }
    }
  }
  return commands.concat(inner);
}

/* `--name value` or `--name=value`, or null. */
function flag(words, name) {
  for (let k = 0; k < words.length; k++) {
    if (words[k] === name) return words[k + 1] === undefined ? '' : words[k + 1];
    if (words[k].startsWith(name + '=')) return words[k].slice(name.length + 1);
  }
  return null;
}

/* Where a shell's relative --file is found: the directory the command runs
   in, which a wrapper may hand over as run_cwd when it points cwd elsewhere. */
function shellFile(name, input, root) {
  const base = (input && (input.run_cwd || input.cwd)) || root;
  const path = name.startsWith('/') ? name : `${base}/${name}`;
  return readFileSync(path, 'utf8');
}

/* One `wrangler … d1 …` command into what it would do: { sql, where } to be
   priced, a [decision, reason], or null for no word. */
function wranglerCall(words, input, root) {
  const at = words.indexOf('d1');
  const sub = words[at + 1] || '';
  const rest = words.slice(at + 2);
  const remote = words.includes('--remote');
  const local = words.includes('--local');
  /* The database is the first plain word after the subcommand, and after
     time-travel's own verb — `time-travel restore <name>`. */
  const named = sub === 'time-travel' ? rest.slice(1) : rest;
  const name = named.find((w) => !w.startsWith('-')) || 'a database';
  const target = `${name}${remote ? ' (remote)' : ''}`;
  if (sub === 'delete') return ['deny', `wrangler d1 delete removes a whole database (${name}). The owner's rule is that tables are never dropped, and a database is all of them.`];
  if (sub === 'time-travel') {
    return words.includes('restore')
      ? ['deny', `wrangler d1 time-travel restore puts ${name} back to an earlier minute and throws away every save, list and sign-up since. That is the owner's to run from their own terminal, never a session's.`]
      : null;
  }
  if (local && !remote) return null;
  if (sub === 'execute') {
    if (!remote) {
      return ['ask', `wrangler d1 execute on ${name} says neither --local nor --remote, and which one it reaches has changed between wrangler versions. Say --local for the copy under .wrangler/state; a --remote read is priced like any other.`];
    }
    const command = flag(words, '--command');
    if (command) return { sql: command, where: target };
    const file = flag(words, '--file');
    if (file) {
      try {
        return { sql: shellFile(file, input, root), where: `${target}, from ${file}` };
      } catch (e) {
        return ['ask', `wrangler d1 execute --remote --file ${file}: the gate could not read the file to price it, so it is asking.`];
      }
    }
    return ['ask', `wrangler d1 execute --remote on ${name} with no --command or --file the gate can read, so it is asking rather than guessing.`];
  }
  if (sub === 'migrations') {
    return words.includes('apply') ? ['ask', `wrangler d1 migrations apply --remote changes the shape of ${name}. That is the owner's call.`] : null;
  }
  if (sub === 'export') {
    return ['ask', `wrangler d1 export --remote reads every row of every table it takes from ${name}, and no hand-run read is to bring more than ${READ_MAX.toLocaleString('en')}. Export the schema only (--no-data), or ask the owner.`];
  }
  if (/^(create|list|info|insights)$/.test(sub)) return null;
  return ['ask', `wrangler d1 ${sub} --remote on ${name} is a command the gate does not know, so it is asking.`];
}

/* Anything else that names D1's API in Cloudflare's: asked about, and refused
   where it restores. */
function apiCall(text) {
  if (!/\/d1\/database|d1\s*\.?\s*database|\bd1\b/i.test(text)) return null;
  if (/time[_-]?travel|\/restore\b|\brestore\b/i.test(text)) {
    return ['deny', 'This reaches D1 to restore a database to an earlier point, which throws away everything written since. That is the owner\'s to run, never a session\'s.'];
  }
  if (/\/(query|raw|import|export)\b|\bquery\b|\bimport\b|\bexport\b/i.test(text)) {
    return ['ask', 'This reaches D1 through a door the gate cannot read down to SQL, so it cannot price it. Use d1_database_query, which is priced, or say what it reads and how many rows.'];
  }
  return null;
}

/* What a call would do, as a list: { sql, where } to price, [decision,
   reason], or nothing. Null where the call is not the gate's at all. */
function callsIn(input, root) {
  const tool = String((input && input.tool_name) || '');
  const ti = (input && input.tool_input) || {};
  if (tool === 'Bash') {
    const line = String(ti.command || '');
    const found = [];
    let wrangler = false;
    for (const words of shellCommands(line)) {
      const at = words.indexOf('d1');
      if (at > 0 && words.slice(0, at).some((w) => /(^|\/)wrangler(@[^\s]*)?$/.test(w))) {
        wrangler = true;
        const one = wranglerCall(words, input, root);
        if (one) found.push(one);
      }
    }
    /* What the reader missed, the raw line still shows. */
    if (!wrangler && /wrangler[\s\S]*\bd1\b/.test(line)) {
      found.push(['ask', 'This runs wrangler d1 in a shape the gate cannot read (a variable, a script, a quote it lost), so it is asking.']);
    }
    if (/api\.cloudflare\.com/i.test(line)) {
      const one = apiCall(line);
      if (one) found.push(one);
    }
    return found.length ? found : null;
  }
  if (!tool.startsWith('mcp__')) return null;
  const sql = [ti.sql, ti.query, ti.command].find((v) => typeof v === 'string');
  if (/d1/i.test(tool)) {
    if (/(delete|drop|restore|import)/i.test(tool)) {
      return [['deny', `${tool} would delete, restore or load a D1 database. Not from a session: that is the owner's, from their own terminal.`]];
    }
    if (sql !== undefined) {
      return [{ sql, where: databaseName(ti.database_id || ti.databaseId, root) }];
    }
    if (/(query|execute|raw|export)/i.test(tool)) {
      return [['ask', `${tool} reaches D1 without SQL the gate can read, so it cannot be priced and is asking.`]];
    }
    return null;
  }
  const one = apiCall(JSON.stringify(ti));
  return one ? [one] : null;
}

/* The one answer for a call: the most severe of its parts, or null for no
   word. A shell line never gets `allow` — see above. */
async function decide(input, root, kept) {
  const calls = callsIn(input, root);
  if (!calls) return null;
  let worst = null;
  for (const call of calls) {
    const one = Array.isArray(call) ? call : await verdict(call.sql, call.where, root, kept);
    if (!worst || RANK[one[0]] > RANK[worst[0]]) worst = one;
  }
  if (input.tool_name === 'Bash' && worst && worst[0] === 'allow') return null;
  return worst;
}

function answer(decision, reason) {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: decision,
      permissionDecisionReason: reason
    }
  }));
  process.exit(0);
}

/* Every shape this has had to get right, kept in the file it guards.
 *
 *   node .claude/hooks/d1-write-gate.mjs --check
 *
 * CI runs it beside the validator. A gate nothing tests is a gate that quietly
 * stops gating the first time somebody tidies a regular expression — and the
 * interesting cases are the ones that read like the opposite of what they are:
 * a venue with "update" in its name, a write hidden behind a comment, a CTE
 * that ends in a DELETE. */
const CASES = [
  ['allow', 'SELECT COUNT(*) FROM google_venues'],
  ['allow', "SELECT cuisine FROM google_venues WHERE place_id = 'ChIJFya2Fk2TkkYRxnF77NpA3NI'"],
  ['allow', "SELECT group_concat(row, ' ') FROM (SELECT cuisine || '=' || COUNT(*) AS row FROM google_venues GROUP BY cuisine)"],
  ['allow', 'EXPLAIN QUERY PLAN SELECT * FROM saves'],
  ['allow', 'PRAGMA table_info(google_venues)'],
  ['allow', 'SELECT 1 AS a; SELECT 2 AS b;'],
  /* The name of a café, not a verb. */
  ['allow', "SELECT name FROM google_venues WHERE name LIKE '%update%'"],
  ['allow', 'WITH top AS (SELECT * FROM lists LIMIT 5) SELECT * FROM top'],

  /* A read is priced. The one that read 6,602,979 rows on 2026-11-18: each
     ride's points joined to its own, twice over. */
  ['ask', "WITH p AS (SELECT r.id, l.key k, json_extract(l.value,'$[0]') lat, json_extract(t.value,'$[0]') t FROM rides r, json_each(r.line) l, json_each(r.track) t WHERE t.key = l.key) SELECT a.id, b.t - a.t dt FROM p a JOIN p b ON b.id = a.id AND b.k = a.k + 1"],
  /* And the same question walked once, which read 29,228: under the day's
     allowance by a long way and still fifteen times the line, so it asks. */
  ['ask', "SELECT r.id, t.key, json_extract(t.value,'$[0]') - LAG(json_extract(t.value,'$[0]')) OVER (PARTITION BY r.id ORDER BY t.key) dt FROM rides r, json_each(r.track) t"],
  /* A whole table under the line runs; one over it, or with no size, asks. */
  ['allow', 'SELECT COUNT(*) n, SUM(meters) m FROM rides'],
  ['allow', 'SELECT COUNT(*) blocks, SUM(stops) stops FROM ride_blocks'],
  /* ride_sections was under the line until it grew: 1,920 rows on
     2026-11-19 and 6,291 on 2026-11-27, when a count of it asked nobody
     and read 12,582. */
  ['ask', 'SELECT COUNT(*) cells, SUM(stops) stops FROM ride_sections'],
  ['ask', 'SELECT * FROM visitor_counts'],
  ['ask', "SELECT kind, SUM(n) FROM visitor_counts WHERE day >= '2026-11-01' GROUP BY kind"],
  ['ask', 'SELECT * FROM flow_counts'],
  /* By its whole key, and a peek at the top of a big one. */
  ['allow', "SELECT n FROM visitor_counts WHERE day = '2026-11-18' AND kind = 'shown' AND id = ''"],
  ['allow', 'SELECT * FROM visitor_counts LIMIT 5'],
  ['ask', 'SELECT COUNT(*) FROM visitor_counts LIMIT 5'],
  /* Two small tables with nothing joining them are one big read. */
  ['ask', 'SELECT COUNT(*) FROM list_items a, list_items b'],
  ['allow', "SELECT name FROM sqlite_master WHERE type = 'table'"],
  /* An apostrophe inside a literal is content, not a comment, and the write
     after it is still a write. This got through the first version. */
  ['deny', "SELECT 'it--s'; UPDATE saves SET count = 1 WHERE id = 'x'"],
  /* And a quote inside a comment is comment text, not the start of a literal
     that swallows the statement after it — the hole the other order has. */
  ['deny', "SELECT 1 /* don't */; UPDATE saves SET count = 1 WHERE id = 'x'"],
  ['deny', "SELECT 1 -- don't\n; DELETE FROM saves WHERE id = 'x'"],
  /* '' is an escaped quote, so the literal runs to the last one and this is
     one plain SELECT. */
  ['allow', "SELECT 'it''s fine' AS x"],
  ['allow', "SELECT * FROM google_venues WHERE name = 'Kaks Kokapoissi -- Uulits'"],

  /* Rows named, and few enough to read. */
  ['ask', "UPDATE google_venues SET cuisine = 'Burgers' WHERE place_id IN ('a', 'b')"],
  ['ask', "INSERT INTO google_venues (place_id, name) VALUES ('x', 'y') ON CONFLICT(place_id) DO UPDATE SET name = excluded.name"],
  ['ask', "DELETE FROM list_items WHERE list_id = 'l1' AND place_id IN ('a', 'b', 'c')"],
  ['ask', "UPDATE lists SET title = 'x' WHERE id = 'l1'"],
  /* users comes after a table that ends `) WITHOUT ROWID;`, which once hid
     its key from the reader and refused this outright. */
  ['ask', "UPDATE users SET links = '' WHERE id = 'u1'"],
  ['ask', "UPDATE visitor_live SET n = 0 WHERE slot = 3"],
  /* Over twenty and under a hundred: it runs, with the count in the prompt. */
  ['ask', `UPDATE google_venues SET cuisine = 'Burgers' WHERE place_id IN (${Array.from({ length: 49 }, (_, i) => `'id${i}'`).join(', ')})`],
  /* The line itself. */
  ['ask', `UPDATE google_venues SET cuisine = 'x' WHERE place_id IN (${Array.from({ length: 100 }, (_, i) => `'id${i}'`).join(', ')})`],
  ['deny', `UPDATE google_venues SET cuisine = 'x' WHERE place_id IN (${Array.from({ length: 101 }, (_, i) => `'id${i}'`).join(', ')})`],
  /* Counted across the whole call, not per statement, or a thousand rows is
     ten statements of a hundred. */
  ['deny', `UPDATE google_venues SET cuisine = 'x' WHERE place_id IN (${Array.from({ length: 60 }, (_, i) => `'a${i}'`).join(', ')}); UPDATE google_venues SET cuisine = 'y' WHERE place_id IN (${Array.from({ length: 60 }, (_, i) => `'b${i}'`).join(', ')})`],
  /* A batch out of db/google-venues.sql: fifty tuples and the upsert's own
     parenthesis, which is not a row. */
  ['ask', `INSERT INTO google_venues (place_id, name) VALUES ${Array.from({ length: 50 }, (_, i) => `('id${i}', 'n${i}')`).join(', ')} ON CONFLICT(place_id) DO UPDATE SET name = excluded.name`],

  /* Rows not named: the size is not in the statement, so it does not run. */
  ['deny', "UPDATE google_venues SET cuisine = 'Burgers' WHERE cuisine = 'American'"],
  ['deny', "DELETE FROM saves WHERE owner = 'x'"],
  ['deny', "UPDATE google_venues SET hidden = 1 WHERE name LIKE '%Hesburger%'"],
  ['deny', "DELETE FROM list_items WHERE list_id = 'l1'"],
  ['deny', "UPDATE lists SET title = 'x' WHERE id IN (SELECT id FROM lists)"],
  ['deny', 'INSERT INTO saves (place_id, owner) SELECT place_id, owner FROM added_places'],
  ['deny', "UPDATE nonexistent_table SET a = 1 WHERE id = 'x'"],

  /* A read in front of a write is a write, and this one names no rows. */
  ['deny', "SELECT 1; UPDATE saves SET count = 0 WHERE id = 'x'"],
  ['deny', 'WITH gone AS (SELECT id FROM lists) DELETE FROM lists WHERE id IN (SELECT id FROM gone)'],
  /* The owner's standing instruction, and not a matter of asking. */
  ['deny', 'DROP TABLE google_venues'],

  /* Shape rather than rows: no cap to apply, still asks. */
  ['ask', 'CREATE TABLE IF NOT EXISTS x (a TEXT)'],
  ['ask', 'PRAGMA foreign_keys = ON'],
  ['ask', 'VACUUM'],
  /* The comment hides the first semicolon, not the statement after it. */
  ['deny', "SELECT 1 -- ; UPDATE saves SET count = 0\n; UPDATE saves SET count = 1 WHERE id = 'x'"],
  /* 2026-11-18: each day of visitor_counts walked flow_counts whole. */
  ['ask', 'SELECT v.day, v.n, (SELECT COUNT(*) FROM flow_counts f WHERE f.day = v.day) AS flow_rows FROM (SELECT day, COUNT(*) AS n FROM visitor_counts GROUP BY day) v'],
  ['ask', '']
];

/* Whole calls, through every door the hook is wired to. null is no word. */
const sh = (command) => ({ tool_name: 'Bash', tool_input: { command } });
const mcp = (tool_name, tool_input) => ({ tool_name, tool_input });
const PROD = '3eb14127-0ef6-4935-954b-e0a593d465ba';
const CALLS = [
  [null, sh('ls -la && git status')],
  [null, sh('node tools/validate.mjs')],
  [null, sh('npx wrangler d1 execute tallinntastebuds-preview --local --file=db/schema.sql')],
  /* Cheap, so no word: the shell's own permissions decide, never the gate's allow. */
  [null, sh('npx wrangler d1 execute tallinntastebuds --remote --command "SELECT COUNT(*) FROM saves"')],
  ['ask', sh('npx wrangler d1 execute tallinntastebuds --remote --command "SELECT COUNT(*) FROM flow_counts"')],
  ['ask', sh("npx wrangler d1 execute tallinntastebuds --remote --command='SELECT * FROM visitor_counts'")],
  ['deny', sh('npx wrangler d1 execute tallinntastebuds --remote --command "DELETE FROM saves"')],
  ['deny', sh('npx wrangler d1 execute tallinntastebuds --remote --command "DROP TABLE saves"')],
  ['ask', sh('wrangler d1 execute tallinntastebuds --command "SELECT 1"')],
  ['deny', sh('npx wrangler d1 execute tallinntastebuds --remote --file=db/google-venues.sql')],
  ['ask', sh('npx wrangler d1 execute tallinntastebuds --remote --file=no/such/file.sql')],
  ['ask', sh('cd /tmp && npx wrangler d1 execute tallinntastebuds --remote --command "SELECT 1"; npx wrangler d1 export tallinntastebuds --remote --output=x.sql')],
  ['deny', sh('npx wrangler d1 time-travel restore tallinntastebuds --timestamp=1700000000')],
  ['deny', sh('npx wrangler d1 delete tallinntastebuds -y')],
  ['ask', sh('npx wrangler d1 migrations apply tallinntastebuds --remote')],
  [null, sh('npx wrangler d1 list')],
  ['ask', sh("bash -c 'npx wrangler d1 execute tallinntastebuds --remote --command \"SELECT * FROM flow_counts\"'")],
  ['ask', sh('W=wrangler; npx $W d1 execute tallinntastebuds --remote --command "SELECT 1"')],
  ['ask', sh(`curl -X POST https://api.cloudflare.com/client/v4/accounts/x/d1/database/${PROD}/query -d '{"sql":"SELECT 1"}'`)],
  ['deny', sh(`curl -X POST https://api.cloudflare.com/client/v4/accounts/x/d1/database/${PROD}/time_travel/restore`)],
  ['allow', mcp('mcp__Cloudflare_Developer_Platform__d1_database_query', { database_id: PROD, sql: 'SELECT COUNT(*) FROM saves' })],
  ['ask', mcp('mcp__Cloudflare_Developer_Platform__d1_database_query', { database_id: PROD, sql: 'SELECT COUNT(*) FROM flow_counts' })],
  ['ask', mcp('mcp__cloudflare_d1__query', { databaseId: PROD, query: 'SELECT * FROM visitor_counts' })],
  ['deny', mcp('mcp__cloudflare_d1__query', { databaseId: PROD, query: 'DELETE FROM saves' })],
  ['ask', mcp('mcp__cloudflare_d1__execute', { databaseId: PROD })],
  ['deny', mcp('mcp__Cloudflare_Developer_Platform__d1_database_delete', { database_id: PROD })],
  [null, mcp('mcp__Cloudflare_Developer_Platform__d1_databases_list', {})],
  [null, mcp('mcp__Cloudflare_Developer_Platform__workers_list', {})],
  ['ask', mcp('mcp__cloudflare-api__execute', { code: `await cf.request('POST', '/accounts/x/d1/database/${PROD}/query', { sql: 'SELECT 1' })` })],
  ['deny', mcp('mcp__cloudflare-api__execute', { code: `await cf.request('POST', '/accounts/x/d1/database/${PROD}/time_travel/restore')` })],
  [null, mcp('mcp__cloudflare-api__execute', { code: "await cf.request('GET', '/zones')" })]
];

if (process.argv.includes('--check')) {
  let bad = 0;
  /* Every table the schema creates has a size, so a walk of a new one is
     priced rather than asked about as unknown — the prompt then says what it
     would cost. A table added to db/schema.sql adds its line above. */
  const schema = readFileSync(`${process.cwd()}/db/schema.sql`, 'utf8');
  for (const [, table] of schema.matchAll(/^CREATE TABLE IF NOT EXISTS ([a-z_0-9]+)/gm)) {
    if (!(table in SIZES)) {
      bad++;
      console.log(`FAIL  ${table} is in db/schema.sql and has no line in SIZES`);
    }
  }
  for (const [want, sql] of CASES) {
    const [got] = await verdict(sql, 'a database', process.cwd());
    if (got !== want) {
      bad++;
      console.log(`FAIL  wanted ${want}, got ${got}: ${JSON.stringify(sql).slice(0, 90)}`);
    }
  }
  for (const [want, input] of CALLS) {
    const got = await decide(input, process.cwd(), { rows: 0, over: [] });
    const word = got ? got[0] : null;
    if (word !== want) {
      bad++;
      console.log(`FAIL  wanted ${want}, got ${word}: ${JSON.stringify(input.tool_input).slice(0, 90)}`);
    }
  }
  console.log(bad
    ? `\nd1-write-gate: ${bad} of ${CASES.length + CALLS.length} cases wrong.`
    : `d1-write-gate — ${CASES.length + CALLS.length} cases, every write asks and every read is priced, through every door.`);
  process.exit(bad ? 1 : 0);
}
const AFTER = process.argv.includes('--after');

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => { raw += chunk; });
process.stdin.on('end', async () => {
  let input;
  try {
    input = JSON.parse(raw);
  } catch (e) {
    if (AFTER) return;
    answer('ask', 'The D1 gate could not read this tool call, so it is asking rather than guessing.');
  }
  const root = (input && (input.cwd || input.project_dir)) || process.cwd();
  /* A call from before tool_name was read, or a test, is the one tool. */
  if (input && !input.tool_name) input.tool_name = 'mcp__Cloudflare_Developer_Platform__d1_database_query';
  const calls = callsIn(input, root);
  if (!calls) process.exit(0);
  if (AFTER) {
    /* Only what reached a remote database is the day's. */
    if (calls.some((c) => !Array.isArray(c))) meter(input);
    return;
  }
  const decided = await decide(input, root, ledger(root));
  if (!decided) process.exit(0);
  answer(...decided);
});
