/**
 * Tallinn Tastebuds — what a post somebody wrote is, and how it is read.
 *
 * Underscore-prefixed, so a module and never a route. Two callers:
 * ./posts.js, which takes posts in and hands them out as JSON, and
 * ../blog.js, which writes one into the page as text for a search engine.
 * What they share is here so that the rule about what a post may hold is
 * written once — the page that draws a post, the route that stores it and
 * the route that serves it to a crawler cannot disagree about what a link
 * is if there is one copy of the answer.
 *
 * A POST IS BLOCKS, NEVER HTML
 *
 * The editor on /write is a contenteditable, which is to say a box the
 * browser fills with whatever HTML it likes — and whatever a pasted Word
 * document or web page brings with it. None of that is stored. The editor
 * reads its own box into blocks before it sends (readBox() in
 * assets/write.js), this file reads those blocks again on the way in and
 * keeps only the kinds it knows, and both drawers build the page out of the
 * blocks as text. A post is therefore never a way to put a script, a style or
 * an iframe on this site's pages, and it never was a question of escaping
 * well enough: there is no markup in the database to escape.
 *
 *   { k: 'p' | 'h2' | 'h3' | 'quote', r: [run, …] }   a paragraph, a heading,
 *                                                       a quote
 *   { k: 'ul' | 'ol', li: [[run, …], …] }              a list
 *   { k: 'place', id: '<id>' }                         a place, drawn as a card:
 *                                                       the map's id, or a
 *                                                       Google venue's key
 *   { k: 'hr' }                                         a divider
 *
 *   run: { t: 'words', b: 1?, i: 1?, a: '<href>'? }
 *
 * A link goes to a path on this site or to an http(s) address anywhere else,
 * and to nothing else: no javascript:, no data:, no //host dressed as a path.
 *
 * THE CAPS
 *
 * Restated in assets/write.js, which counts against them as the writer
 * types; the server's are the ones that bind. MAX_BODY is characters of
 * words, not of JSON — what a writer can see — and twenty thousand is a long
 * magazine piece, which is more than a post about ten places will ever need
 * and few enough that a page of ten never weighs much.
 */

import { LINE_LANGS } from './_profile.js';

export const MAX_TITLE = 120;
export const MAX_LEAD = 280;
export const MAX_BODY = 20000;
export const MAX_BLOCKS = 400;
export const MAX_RUNS = 200;
export const MAX_ITEMS = 100;
export const MAX_HREF = 2048;
/* How many posts one account may keep, drafts included, and how many it may
   start in a day. A blog, not a feed: the second is there so that a script
   with somebody's session cannot fill the index in an afternoon. */
export const MAX_POSTS = 200;
export const MAX_NEW_A_DAY = 10;
/* A page of the index, of a profile's posts and of one's own on /write. */
export const PAGE_SIZE = 10;

export const LANGS = LINE_LANGS;

const TEXT_KINDS = ['p', 'h2', 'h3', 'quote'];
const LIST_KINDS = ['ul', 'ol'];

/* An id somebody's post has: the slug and four hex. Anything else is not
   looked up. */
export const POST_ID = /^[a-z0-9][a-z0-9-]{0,70}-[0-9a-f]{4}$/;

/* A link a run may carry, or ''. */
export function cleanHref(raw) {
  const href = String(raw || '').trim();
  if (!href || href.length > MAX_HREF) return '';
  if (/^\/(?!\/)[^\s]*$/.test(href)) return href;
  if (/^https?:\/\/[^\s/]+[^\s]*$/i.test(href)) {
    try {
      const url = new URL(href);
      return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : '';
    } catch (e) {
      return '';
    }
  }
  return '';
}

/* Whitespace as a reader sees it: no control characters, no runs of
   spaces the browser would fold anyway. A line break inside a paragraph is
   kept, because a shift-enter in the editor is somebody asking for one. */
function words(raw) {
  return String(raw == null ? '' : raw)
    .replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, ' ')
    .replace(/ /g, ' ')
    .replace(/ {2,}/g, ' ');
}

function cleanRuns(raw, tally) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const run of raw.slice(0, MAX_RUNS)) {
    if (!run || typeof run !== 'object') continue;
    const t = words(run.t);
    if (!t) continue;
    const kept = { t };
    if (run.b) kept.b = 1;
    if (run.i) kept.i = 1;
    const a = cleanHref(run.a);
    if (a) kept.a = a;

    /* Two runs dressed the same are one run: the editor splits text at every
       node the browser happened to make, and the stored body should not
       carry the browser's history. */
    const last = out[out.length - 1];
    if (last && !!last.b === !!kept.b && !!last.i === !!kept.i && (last.a || '') === (kept.a || '')) {
      last.t += t;
    } else {
      out.push(kept);
    }
    tally.chars += t.length;
  }
  /* Trailing and leading spaces off the block as a whole, never a run's own
     inner spacing, which is what separates a bold word from the next. */
  if (out.length) {
    out[0].t = out[0].t.replace(/^\s+/, '');
    out[out.length - 1].t = out[out.length - 1].t.replace(/\s+$/, '');
  }
  return out.filter((r) => r.t);
}

/* The body as the editor sent it, kept to what a post may be. Answers
   { blocks, chars, words } — chars to hold against MAX_BODY, words for the
   read time — or null for something that is not a body at all. `places` is
   the set of ids a place card may name, the map's and the export's; one that
   is in neither is dropped rather than refused, since both change under a
   post. */
export function cleanBody(raw, places) {
  if (!Array.isArray(raw)) return null;
  const tally = { chars: 0 };
  const blocks = [];
  for (const block of raw.slice(0, MAX_BLOCKS)) {
    if (!block || typeof block !== 'object') continue;
    const k = block.k;
    if (TEXT_KINDS.includes(k)) {
      const r = cleanRuns(block.r, tally);
      if (r.length) blocks.push({ k, r });
    } else if (LIST_KINDS.includes(k)) {
      const li = (Array.isArray(block.li) ? block.li : []).slice(0, MAX_ITEMS)
        .map((item) => cleanRuns(item, tally))
        .filter((item) => item.length);
      if (li.length) blocks.push({ k, li });
    } else if (k === 'place') {
      const id = String(block.id || '');
      if (places && places.has(id)) blocks.push({ k, id });
    } else if (k === 'hr') {
      /* Two dividers in a row, or one at the top, say nothing. */
      if (blocks.length && blocks[blocks.length - 1].k !== 'hr') blocks.push({ k });
    }
  }
  while (blocks.length && blocks[blocks.length - 1].k === 'hr') blocks.pop();
  return { blocks, chars: tally.chars, words: countWords(blocks) };
}

/* Every run of a body, in order: what the word count and the plain text are
   both made of. */
function runsOf(blocks) {
  const out = [];
  for (const b of blocks || []) {
    if (b.r) out.push(b.r);
    if (b.li) for (const item of b.li) out.push(item);
  }
  return out;
}

export function plainText(blocks) {
  return runsOf(blocks).map((runs) => runs.map((r) => r.t).join('')).join('\n');
}

export function countWords(blocks) {
  return plainText(blocks).split(/\s+/).filter(Boolean).length;
}

/* The body out of its column, or an empty one: a row written by an older
   version of this file, or by hand, must draw as nothing rather than throw. */
export function readBody(raw) {
  try {
    const parsed = JSON.parse(String(raw || '[]'));
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

/* One line, for a title or the standfirst. */
export function cleanLine(raw, max) {
  return words(raw).replace(/\n+/g, ' ').trim().slice(0, max + 1);
}

/* An id for a post that has never been saved: its first title as a slug, and
   four hex after it so two posts with one title are two addresses. Folded to
   ASCII the way a search result prints an address, so "Põhjala ja õlu"
   becomes pohjala-ja-olu; a title in Cyrillic or Armenian folds to nothing,
   and gets "post" instead, which the four hex characters still make unique. */
export function newId(title) {
  const slug = String(title || '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/, '');
  const tail = Array.from(crypto.getRandomValues(new Uint8Array(2)))
    .map((b) => b.toString(16).padStart(2, '0')).join('');
  return (slug || 'post') + '-' + tail;
}

/* ------------------------------------------------------------- drawing
 *
 * For ../blog.js: the body as HTML for the readers that run no script. Every
 * word goes through `esc`, which that file passes in from ../_shell.js so
 * there is one escaping rule on the site; the tags are this file's own. A
 * link off the site is nofollow and ugc — the writer chose it, not the site.
 */
export function bodyHtml(blocks, esc, placeName) {
  const runs = (rs) => rs.map((r) => {
    let s = esc(r.t).replace(/\n/g, '<br>');
    if (r.b) s = '<strong>' + s + '</strong>';
    if (r.i) s = '<em>' + s + '</em>';
    if (r.a) {
      const out = r.a.charAt(0) !== '/';
      s = '<a href="' + esc(r.a) + '"' + (out ? ' rel="nofollow ugc noopener"' : '') + '>' + s + '</a>';
    }
    return s;
  }).join('');

  return (blocks || []).map((b) => {
    if (b.k === 'p') return '<p>' + runs(b.r) + '</p>';
    if (b.k === 'h2') return '<h2>' + runs(b.r) + '</h2>';
    if (b.k === 'h3') return '<h3>' + runs(b.r) + '</h3>';
    if (b.k === 'quote') return '<blockquote><p>' + runs(b.r) + '</p></blockquote>';
    if (b.k === 'ul' || b.k === 'ol') {
      return '<' + b.k + '>' + b.li.map((item) => '<li>' + runs(item) + '</li>').join('') + '</' + b.k + '>';
    }
    if (b.k === 'place') {
      const name = placeName(b.id);
      return name ? '<p><a href="/?spot=' + esc(b.id) + '">' + esc(name) + '</a></p>' : '';
    }
    if (b.k === 'hr') return '<hr>';
    return '';
  }).join('');
}

/* ------------------------------------------------------------- reading */

/* The one language of a post a reader gets: their own where it was written
   in it, the one it was first written in where it was not. */
export function pickText(texts, lang, first) {
  return texts[lang] || texts[first] || texts[Object.keys(texts)[0]] || null;
}

/* A page of posts as rows: each with every language's title and standfirst,
   never a body, so a page of ten is a few kilobytes whatever was written.
   `where` and `binds` narrow it — published only, or one person's, or both —
   and `before` is the cursor the last page answered with. Answers
   { posts, next }, next being null on the last page. */
export async function readPage(env, where, binds, before) {
  const cursor = parseCursor(before);
  const clauses = [where];
  const args = binds.slice();
  if (cursor) {
    clauses.push('(COALESCE(p.published_at, p.updated_at) < ? OR (COALESCE(p.published_at, p.updated_at) = ? AND p.id < ?))');
    args.push(cursor.at, cursor.at, cursor.id);
  }

  const heads = await env.DB
    .prepare(
      'SELECT p.id AS id, p.lang AS lang, p.status AS status, p.created_at AS created_at, ' +
      'p.updated_at AS updated_at, p.published_at AS published_at, u.username AS author ' +
      'FROM posts p JOIN users u ON u.id = p.owner ' +
      'WHERE ' + clauses.join(' AND ') + ' ' +
      'ORDER BY COALESCE(p.published_at, p.updated_at) DESC, p.id DESC LIMIT ?'
    )
    .bind(...args, PAGE_SIZE + 1)
    .all();

  const rows = (heads.results || []).slice(0, PAGE_SIZE);
  const more = (heads.results || []).length > PAGE_SIZE;
  if (!rows.length) return { posts: [], next: null };

  const ids = rows.map((r) => r.id);
  const texts = await env.DB
    .prepare(
      'SELECT post, lang, title, standfirst, words FROM post_texts WHERE post IN (' +
      ids.map(() => '?').join(',') + ')'
    )
    .bind(...ids)
    .all();

  const byPost = {};
  for (const t of texts.results || []) {
    (byPost[t.post] = byPost[t.post] || {})[t.lang] = { title: t.title, standfirst: t.standfirst, words: t.words };
  }

  const posts = rows.map((r) => ({
    id: r.id,
    lang: r.lang,
    status: r.status,
    at: r.published_at || r.updated_at,
    published: r.published_at || null,
    updated: r.updated_at,
    author: r.author,
    texts: byPost[r.id] || {}
  }));
  const last = rows[rows.length - 1];
  return { posts, next: more ? (last.published_at || last.updated_at) + '~' + last.id : null };
}

function parseCursor(raw) {
  const m = /^(\d{1,16})~([a-z0-9-]{1,80})$/.exec(String(raw || ''));
  return m ? { at: Number(m[1]), id: m[2] } : null;
}

/* One post whole, every language with its body, and who wrote it — or null.
   A draft is answered to its owner alone; to anybody else it does not
   exist, the way a private list does not. */
export async function readPost(env, id, viewer) {
  if (!POST_ID.test(String(id || ''))) return null;
  const row = await env.DB
    .prepare(
      'SELECT p.id AS id, p.owner AS owner, p.lang AS lang, p.status AS status, ' +
      'p.created_at AS created_at, p.updated_at AS updated_at, p.published_at AS published_at, ' +
      'u.username AS author FROM posts p JOIN users u ON u.id = p.owner WHERE p.id = ?'
    )
    .bind(id)
    .first();
  if (!row) return null;
  const mine = !!viewer && viewer.id === row.owner;
  if (row.status !== 'published' && !mine) return null;

  const texts = await env.DB
    .prepare('SELECT lang, title, standfirst, body, words FROM post_texts WHERE post = ?')
    .bind(id)
    .all();
  const out = {};
  for (const t of texts.results || []) {
    out[t.lang] = { title: t.title, standfirst: t.standfirst, body: readBody(t.body), words: t.words };
  }

  return {
    id: row.id,
    lang: row.lang,
    status: row.status,
    at: row.published_at || row.updated_at,
    published: row.published_at || null,
    updated: row.updated_at,
    author: row.author,
    mine,
    texts: out
  };
}

/* Whether the tables are there. db/schema.sql reaches a live database by
   hand, so every reader of these two tables has to survive an afternoon
   without them; this asks once per isolate, the way readingPins() does. */
let ready = null;

export async function postsReady(env) {
  if (ready === true) return true;
  try {
    await env.DB.prepare('SELECT 1 FROM posts LIMIT 1').first();
    await env.DB.prepare('SELECT 1 FROM post_texts LIMIT 1').first();
    ready = true;
  } catch (e) {
    ready = false;
  }
  return ready;
}
