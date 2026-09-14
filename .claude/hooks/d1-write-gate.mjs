#!/usr/bin/env node
/**
 * Tallinn Tastebuds — a write to D1 is the owner's decision, not a session's.
 *
 * A PreToolUse hook on the Cloudflare MCP tool `d1_database_query`, wired in
 * .claude/settings.json. It reads the tool call on stdin and answers with one
 * of three permission decisions:
 *
 *   allow   the SQL is read-only — SELECT, a CTE that only selects, EXPLAIN,
 *           or a PRAGMA being asked rather than set. Checking the state of a
 *           table is how any of this gets verified, and a prompt per SELECT
 *           would mean a dozen prompts to answer one question.
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
 * Zero dependencies, like every other tool in this repository, and it runs
 * from whatever directory Claude Code starts it in — the database names come
 * from wrangler.toml when it can be found, and the raw id is printed when it
 * cannot, so a moved file makes the message vaguer and never makes the gate
 * weaker.
 */

import { readFileSync } from 'node:fs';

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
  const tables = sql.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?([a-z_0-9]+)\s*\(([\s\S]*?)\n\)\s*;/gi);
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

/* The decision and the sentence that goes with it, kept apart from stdin so
   --check below can ask the same question of a table of SQL. */
function verdict(sql, where, root = process.cwd()) {
  const parts = statements(sql);
  if (!parts.length) {
    return ['ask', `Nothing here reads as SQL, so the gate is asking rather than guessing. Target: ${where}.`];
  }
  if (readsOnly(sql)) return ['allow', `Read-only query against ${where}.`];

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
  ['ask', '']
];

if (process.argv.includes('--check')) {
  let bad = 0;
  for (const [want, sql] of CASES) {
    const [got] = verdict(sql, 'a database', process.cwd());
    if (got !== want) {
      bad++;
      console.log(`FAIL  wanted ${want}, got ${got}: ${JSON.stringify(sql).slice(0, 90)}`);
    }
  }
  console.log(bad
    ? `\nd1-write-gate: ${bad} of ${CASES.length} cases wrong.`
    : `d1-write-gate — ${CASES.length} cases, every write asks and every read runs.`);
  process.exit(bad ? 1 : 0);
}

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => { raw += chunk; });
process.stdin.on('end', () => {
  let input;
  try {
    input = JSON.parse(raw);
  } catch (e) {
    answer('ask', 'The D1 gate could not read this tool call, so it is asking rather than guessing.');
  }

  const sql = (input && input.tool_input && input.tool_input.sql) || '';
  const root = (input && (input.cwd || input.project_dir)) || process.cwd();
  const where = databaseName(input && input.tool_input && input.tool_input.database_id, root);

  answer(...verdict(sql, where, root));
});
