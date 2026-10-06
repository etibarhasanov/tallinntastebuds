/**
 * Tallinn Tastebuds — GET/POST /api/posts, the blog members write.
 *
 * The blog was the house's alone — data/blog.json, written in the repository
 * — and this is the half anybody with an account can write in: a post about
 * their ten places, a street worth walking down hungry, whatever they like,
 * in any of the site's ten languages and as many of them as they care to.
 * It lands on /blog under the house's notes and on their profile, and
 * /blog?post=<id> is its address, the same address the house's posts have.
 * **Everybody's posts** under **The blog** in README.md.
 *
 * GET
 *
 *   ?id=<id>                 one post whole: every language with its body.
 *                            A draft only to its owner, and to anybody else
 *                            a 404, the way a private list is not there
 *   ?by=<name>[&before=…]    one person's published posts, a page at a time
 *   ?mine=1[&before=…]       the session's own, drafts included — /write
 *   [?before=…]              everybody's published posts, newest first
 *
 * A page is PAGE_SIZE rows, each with every language's title and standfirst
 * and never a body, and `next` is the cursor for the page after or null. Nothing
 * is ever answered whole: a blog that grows does not grow its first load.
 *
 * POST, always with a session — a post is somebody's, and the ownership rule
 * is the one functions/api/lists.js states in its header: every write but the
 * first reads posts.owner and answers 404 unless it is the session's.
 *
 *   { action: 'save', id?, lang, texts: { <lang>: { title, standfirst, body } }, publish }
 *       makes the post where there is no id, and replaces every language of
 *       it where there is. `publish` is the state it is left in: true
 *       publishes (or keeps it published), false leaves it a draft or takes
 *       it back to one.
 *   { action: 'delete', id }
 *
 * WHAT IT DOES WHEN IT CANNOT
 *
 * Nothing in assets/ waits on this. Without the database, the salt's sibling
 * checks or the two tables, a GET answers `ready: false` and an empty page,
 * and the blog draws the house's notes as it always has; a POST answers
 * 503 and /write says it could not save.
 *
 * Nothing here is cached, for the reason lists.js gives: the owner reads it
 * mid-edit, and a draft is one person's.
 */

import { json, sessionUser, wrongDatabase, knownPlaces, dataFile } from './_lib.js';
import { asUsername } from './_account.js';
import {
  MAX_TITLE, MAX_LEAD, MAX_BODY, MAX_POSTS, MAX_NEW_A_DAY, LANGS, POST_ID,
  cleanBody, cleanLine, newId, readPage, readPost, postsReady
} from './_posts.js';

const NOT_READY = { ready: false, posts: [], next: null, post: null };

async function usable(env) {
  return !!env.DB && !(await wrongDatabase(env)) && (await postsReady(env));
}

export async function onRequestGet(context) {
  const { request, env } = context;
  if (!(await usable(env))) return json(NOT_READY, 200);

  const q = new URL(request.url).searchParams;
  const viewer = await sessionUser(request, env);
  const user = viewer ? viewer.username : null;

  if (q.has('id')) {
    const post = await readPost(env, q.get('id'), viewer);
    if (!post) return json({ ready: true, user, error: 'not-found' }, 404);
    return json({ ready: true, user, post }, 200);
  }

  const before = q.get('before');

  if (q.has('mine')) {
    if (!viewer) return json({ ready: true, user: null, posts: [], next: null }, 200);
    const page = await readPage(env, 'p.owner = ?', [viewer.id], before);
    return json({ ready: true, user, ...page }, 200);
  }

  if (q.has('by')) {
    const name = asUsername(q.get('by'));
    if (!name) return json({ ready: true, user, posts: [], next: null }, 200);
    const page = await readPage(env, "p.status = 'published' AND u.username = ? COLLATE NOCASE", [name], before);
    return json({ ready: true, user, ...page }, 200);
  }

  const page = await readPage(env, "p.status = 'published'", [], before);
  return json({ ready: true, user, ...page }, 200);
}

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!(await usable(env))) return json({ error: 'no-database' }, 503);

  const viewer = await sessionUser(request, env);
  if (!viewer) return json({ error: 'signed-out' }, 401);

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return json({ error: 'bad-request' }, 400);
  }
  if (!body || typeof body !== 'object') return json({ error: 'bad-request' }, 400);

  if (body.action === 'delete') return remove(env, viewer, body.id);
  if (body.action === 'save') return save(context, viewer, body);
  return json({ error: 'bad-action' }, 400);
}

/* The owner of a post, or null for one that is not there. */
async function ownerOf(env, id) {
  if (!POST_ID.test(String(id || ''))) return null;
  return env.DB.prepare('SELECT owner, published_at FROM posts WHERE id = ?').bind(id).first();
}

async function remove(env, viewer, id) {
  const row = await ownerOf(env, id);
  if (!row || row.owner !== viewer.id) return json({ error: 'not-found' }, 404);
  await env.DB.batch([
    env.DB.prepare('DELETE FROM post_texts WHERE post = ?').bind(id),
    env.DB.prepare('DELETE FROM posts WHERE id = ? AND owner = ?').bind(id, viewer.id)
  ]);
  return json({ ok: true }, 200);
}

async function save(context, viewer, body) {
  const { env } = context;

  const lang = String(body.lang || '');
  if (!LANGS.includes(lang)) return json({ error: 'bad-lang' }, 400);
  if (!body.texts || typeof body.texts !== 'object') return json({ error: 'bad-request' }, 400);

  /* Every language it was sent in, kept to what a post may be. One with no
     title is refused rather than dropped: the writer has a tab open for it
     and would find it gone. */
  /* The ids a place card may name: the map's own, open or closed — a post
     about a place that has since closed still says which. */
  const places = await knownPlaces(context).catch(() => new Set());
  const texts = [];
  for (const code of Object.keys(body.texts)) {
    if (!LANGS.includes(code)) return json({ error: 'bad-lang' }, 400);
    const given = body.texts[code] || {};
    const title = cleanLine(given.title, MAX_TITLE);
    const standfirst = cleanLine(given.standfirst, MAX_LEAD);
    const clean = cleanBody(given.body, places);
    if (!title) return json({ error: 'no-title', lang: code }, 400);
    if (title.length > MAX_TITLE || standfirst.length > MAX_LEAD) return json({ error: 'too-long', lang: code }, 400);
    if (!clean) return json({ error: 'bad-request' }, 400);
    if (clean.chars > MAX_BODY) return json({ error: 'too-long', lang: code }, 400);
    texts.push({ lang: code, title, standfirst, body: JSON.stringify(clean.blocks), words: clean.words });
  }
  if (!texts.some((t) => t.lang === lang)) return json({ error: 'no-title', lang }, 400);

  const now = Date.now();
  const publish = !!body.publish;
  let id = body.id;
  const statements = [];

  if (id) {
    const row = await ownerOf(env, id);
    if (!row || row.owner !== viewer.id) return json({ error: 'not-found' }, 404);
    statements.push(env.DB
      .prepare('UPDATE posts SET lang = ?, status = ?, updated_at = ?, published_at = ? WHERE id = ? AND owner = ?')
      .bind(lang, publish ? 'published' : 'draft', now, publish ? (row.published_at || now) : row.published_at, id, viewer.id));
    statements.push(env.DB.prepare('DELETE FROM post_texts WHERE post = ?').bind(id));
  } else {
    const counts = await env.DB
      .prepare('SELECT COUNT(*) AS n, SUM(CASE WHEN created_at > ? THEN 1 ELSE 0 END) AS today FROM posts WHERE owner = ?')
      .bind(now - 86400000, viewer.id)
      .first();
    if (counts && counts.n >= MAX_POSTS) return json({ error: 'too-many' }, 429);
    if (counts && counts.today >= MAX_NEW_A_DAY) return json({ error: 'too-many-today' }, 429);

    /* The id out of the first title, never one the house's posts already
       have: both are /blog?post=, and the house's would win. */
    const house = await dataFile(context, '/data/blog.json').catch(() => []);
    const first = texts.find((t) => t.lang === lang);
    do {
      id = newId(first.title);
    } while ((Array.isArray(house) && house.some((p) => p && p.id === id)) ||
      (await env.DB.prepare('SELECT 1 FROM posts WHERE id = ?').bind(id).first()));

    statements.push(env.DB
      .prepare('INSERT INTO posts (id, owner, lang, status, created_at, updated_at, published_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .bind(id, viewer.id, lang, publish ? 'published' : 'draft', now, now, publish ? now : null));
  }

  for (const t of texts) {
    statements.push(env.DB
      .prepare('INSERT INTO post_texts (post, lang, title, standfirst, body, words) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(id, t.lang, t.title, t.standfirst, t.body, t.words));
  }
  await env.DB.batch(statements);

  return json({ ok: true, post: await readPost(env, id, viewer) }, 200);
}
