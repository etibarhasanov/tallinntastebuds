/**
 * Tallinn Tastebuds — how many rows the site has read from D1 today.
 *
 * D1 bills every row a statement walks, and the free plan stops every read on
 * the account past five million in a UTC day — lists empty, saves and
 * sign-in refused, until midnight. On 2026-11-18 a counter on Discover got
 * there before noon, and nobody knew until the site was empty: the number
 * lived only on the Cloudflare dashboard. **Every read has a price, set
 * before it is written** in CLAUDE.md is how a read is meant to be designed;
 * this is how the site finds out when one was not.
 *
 * WHAT IS COUNTED
 *
 * functions/_middleware.js hands every request's env.DB through meter()
 * below, once per isolate. Every answer D1 gives carries `meta.rows_read`,
 * and the wrapper adds it up, in the isolate, under the table the statement
 * reads first — "which table is being read" is the question the day it goes
 * wrong, and it needs nothing from the request. `first()` is answered by
 * `all()` and its first row, which is what D1's first() is, because first()
 * hands back no meta to count.
 *
 * Every FLUSH_MS the isolate writes what it holds into `read_meter`, a row a
 * day and table, added to — after a request, through waitUntil(), so nobody
 * waits on it. That is the meter's own price: a row written per table an
 * isolate read in the window, which on a busy day is a few thousand of D1's
 * hundred thousand free writes. What it does not see: reads made before it
 * shipped, reads from a terminal or the Cloudflare MCP tool, and what an
 * isolate held when it was thrown away unflushed — so it is a floor, and the
 * Cloudflare dashboard is still the bill.
 *
 * THE BRAKE
 *
 * readsToday() is the day so far, the table's rows for today and this
 * isolate's unflushed ones, read at most once per BRAKE_TTL. braking() is
 * whether that is past BRAKE of the day's five million, and a reader that
 * is a nice-to-have — the flag counter — answers as though it had no table
 * when it is, so what is left of the day goes to lists, saves and signing in.
 *
 * WHEN THE TABLE IS NOT THERE
 *
 * A flush fails quietly and the isolate keeps its counts for the next one;
 * readsToday() answers this isolate's own, and nothing brakes on that alone.
 */

/* D1's free reads in a UTC day, and the share of them past which the
   nice-to-haves stop reading. */
export const DAY_READS = 5000000;
export const BRAKE = 0.7;

const FLUSH_MS = 15 * 60 * 1000;
const BRAKE_TTL = 5 * 60 * 1000;
const METERED = Symbol('metered');
const INNER = Symbol('inner');
const TABLE = Symbol('table');

/* day + '\u0000' + table -> rows, not yet written. */
const held = new Map();
let flushedAt = Date.now();

function utcDay() {
  return new Date().toISOString().slice(0, 10);
}

/* The first table a statement reads, or `other`. */
function tableOf(sql) {
  const m = /\b(?:FROM|JOIN|INTO|UPDATE)\s+["`]?([A-Za-z_][A-Za-z0-9_]*)/i.exec(sql);
  return m ? m[1].toLowerCase() : 'other';
}

function add(table, result) {
  const n = result && result.meta && Number(result.meta.rows_read);
  if (!(n > 0)) return;
  const key = utcDay() + '\u0000' + table;
  held.set(key, (held.get(key) || 0) + n);
}

function statement(inner, table) {
  return {
    [INNER]: inner,
    [TABLE]: table,
    bind: (...args) => statement(inner.bind(...args), table),
    async all() {
      const result = await inner.all();
      add(table, result);
      return result;
    },
    async run() {
      const result = await inner.run();
      add(table, result);
      return result;
    },
    async first(column) {
      const result = await inner.all();
      add(table, result);
      const row = (result.results || [])[0];
      if (!row) return null;
      if (column === undefined) return row;
      if (!(column in row)) throw new Error('D1_COLUMN_NOTFOUND: ' + column);
      return row[column];
    },
    raw: (...args) => inner.raw(...args)
  };
}

/* env.DB, counted. Wrapping a wrapped one hands it back. */
export function meter(db) {
  if (!db || db[METERED]) return db;
  return {
    [METERED]: true,
    [INNER]: db,
    prepare: (sql) => statement(db.prepare(sql), tableOf(String(sql))),
    async batch(list) {
      const results = await db.batch(list.map((s) => (s && s[INNER]) || s));
      results.forEach((r, i) => add((list[i] && list[i][TABLE]) || 'other', r));
      return results;
    },
    exec: (...args) => db.exec(...args),
    dump: (...args) => db.dump(...args),
    withSession: (...args) => db.withSession(...args)
  };
}

/* What this isolate holds, written, when FLUSH_MS has gone by. For
   waitUntil(); never throws. */
export async function flush(db) {
  if (!db || !held.size || Date.now() - flushedAt < FLUSH_MS) return;
  const rows = [...held.entries()];
  held.clear();
  flushedAt = Date.now();
  /* The binding itself, so the meter's own write is not metered. */
  const target = db[INNER] || db;
  try {
    await target.batch(rows.map(([key, n]) => {
      const [day, table] = key.split('\u0000');
      return target
        .prepare('INSERT INTO read_meter (day, what, rows) VALUES (?, ?, ?) ' +
          'ON CONFLICT (day, what) DO UPDATE SET rows = read_meter.rows + excluded.rows')
        .bind(day, table, n);
    }));
  } catch (e) {
    /* No table yet, or the write failed: keep the counts for next time. */
    for (const [key, n] of rows) held.set(key, (held.get(key) || 0) + n);
  }
}

/* Today so far, by table, most first: [{ what, rows }]. Null where the
   table is not there. */
export async function readsByTable(db, day) {
  try {
    const { results } = await (db[INNER] || db)
      .prepare('SELECT what, rows FROM read_meter WHERE day = ? ORDER BY rows DESC')
      .bind(day)
      .all();
    return results;
  } catch (e) {
    return null;
  }
}

/* The day's total so far — THE BRAKE — read at most once per BRAKE_TTL. */
let today = null;
export async function readsToday(db) {
  const day = utcDay();
  if (!today || today.day !== day || Date.now() - today.at > BRAKE_TTL) {
    const rows = await readsByTable(db, day);
    today = { day, at: Date.now(), rows: (rows || []).reduce((s, r) => s + r.rows, 0) };
  }
  let mine = 0;
  for (const [key, n] of held) if (key.startsWith(day)) mine += n;
  return today.rows + mine;
}

export async function braking(db) {
  return (await readsToday(db)) > DAY_READS * BRAKE;
}
