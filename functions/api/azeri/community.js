/**
 * Tallinn Tastebuds — /api/azeri/community, the Azerbaijani Corner's
 * Community: members post, comment and upvote, like a small Reddit for
 * Azerbaijanis in Estonia. /azeri?tab=community is the page, drawn by
 * assets/azeri.js, and this is the only thing that writes its four tables —
 * azeri_posts, azeri_comments, azeri_votes and azeri_seen in db/schema.sql.
 * **Community** under **The Azerbaijani corner** in docs/handbook.md.
 *
 * WHO
 *
 * The corner is open to anybody, with the owner's rule beside it: reading
 * is anybody's, and an account is for writing something. So every GET
 * answers without a session — `user` null, nothing marked new, no upvotes
 * of one's own — and every POST needs one, 401 `signed-out` without. A post
 * and a comment are their author's — every write but a vote reads the row's
 * owner first and answers 404 unless it is the session's — and the site's
 * owner, a users.id in ADMINS, may take down anybody's: `mod` in every
 * answer says the page may offer it. Nobody upvotes their own.
 *
 * GET
 *
 *   [?sort=top][&after=<cursor> | &before=<cursor>]
 *       a page of PAGE posts, newest first, or this week's (Monday to
 *       Sunday in Tallinn) most upvoted first with sort=top. `next` is the
 *       cursor for the page after or null, `first` the cursor for the page
 *       before, which `prev` says there is. Each post: id, title, lead (the
 *       first 280 characters of its text), author, mine, at, edited, score,
 *       voted, comments, gone, fresh (posted by somebody else since the
 *       visit before this one) and freshComments (others' comments since
 *       then, up to FRESH_CAP).
 *   ?post=<id>[&after=<n>]
 *       one post whole, and its comments after the n-th, oldest first,
 *       COMMENTS at a time; `more` is how many come after the last one sent.
 *       Each comment: n, author, mine, body, at, edited, score, voted,
 *       replyTo and replyAuthor, gone (1 deleted by its author, 2 taken
 *       down), fresh. A post that is not there is 404 `not-found`.
 *   ?news=1
 *       { user, news: { posts, mine } } — what lights the dot on Community's
 *       tab while another tab of the corner is read: posts by others since
 *       the member last opened Community, up to ten, and comments on their
 *       own since then. communityNews() in ../_community.js. Signed out, or
 *       without the tables, `news` is null and nothing is read.
 *
 * A member's GET of the posts or a post is a look at Community, and moves
 * their azeri_seen row: look() below. Every answer carries `user`, `mod` and
 * `ready`; without the tables it is `{ ready: false }` and the page says it
 * could not load. Signed out, the answer is the same for everybody, so it
 * is kept ANON_TTL in the colo — never in the browser, which would hand it
 * back to the same person a minute after they signed in.
 *
 * POST, a JSON body with an `action`:
 *
 *   post         { title, body }            → { id }
 *   edit         { id, title, body }        → { id }
 *   delete       { id }                     → { ok }    the author's, or the
 *                                                       site owner's take-down
 *   comment      { post, body, replyTo? }   → { comment }
 *   editcomment  { post, n, body }          → { ok }
 *   uncomment    { post, n }                → { ok }    as delete
 *   vote         { post, n, on }            → { score, voted }   n 0 is the post
 *
 * Refused with `title`, `empty`, `too-long`, `often` (past POSTS_A_DAY or
 * COMMENTS_A_DAY in a day), `gone` (a deleted post takes no more comments),
 * `own` (an upvote of one's own), `not-found`, `bad-request`, and 503
 * `not-ready` where the tables are not applied yet.
 *
 * WHAT IT COSTS — rows read, worked out from SQLite's plans and the keys,
 * since production has no rows to measure until the tables are applied;
 * every statement names the front of a key, so none grows with the table:
 *
 *   any GET          the session (1–2) and azeri_seen (1), and a write of
 *                    that row on opening the posts, and otherwise at most
 *                    once a minute; signed out, no session and no row of
 *                    azeri_seen, and the answer at most once a minute per
 *                    colo for each address
 *   the dot          the session, azeri_seen and up to ten posts: about a
 *                    dozen, once each time another tab is shown
 *   a page of posts  PAGE + 1 posts and their authors (42), the upvotes the
 *                    member gave them (≤ 20), and for each post with
 *                    comments since the last visit its last FRESH_CAP (≤ 200,
 *                    and none on most days): about 65, 260 at the very worst
 *   a post           the post and its author (2), a page of comments, their
 *                    authors and the comments they answer with theirs (≤ 200),
 *                    the member's upvotes among them (≤ 51): about 150 for a
 *                    full page, a dozen for most
 *   a write          the row it changes and the day's count (≤ 50)
 *
 * A thousand members each reading five pages of posts and opening ten posts
 * a day is about 2 million rows of the five million, on the worst day; a
 * hundred is 200,000. The corner is linked from nowhere.
 *
 * Nothing here is cached: every answer is one person's.
 */

import { json, privately, sessionUser, wrongDatabase, randomHex } from '../_lib.js';
import { adminIds } from '../_admin.js';
import {
  MAX_TITLE, MAX_BODY, MAX_COMMENT, POSTS_A_DAY, COMMENTS_A_DAY, VISIT_MS, weekOf, communityReady, communityNews
} from '../_community.js';

const PAGE = 20;
const COMMENTS = 50;
const FRESH_CAP = 10;
const DAY_MS = 86400000;
const POST_ID = /^[0-9a-f]{10}$/;
const END = Number.MAX_SAFE_INTEGER;
const ANON_TTL = 60;

/* Whoever wrote a post, by users' key: owner is TEXT, as users.id is. The
   statements' constants carry COMMUNITY_ in their names because
   tools/sqlcheck.mjs reads a constant by its name across every file, and
   AUTHOR, CARD and NEWEST were already somebody else's. */
const COMMUNITY_POSTER = 'LEFT JOIN users u ON u.id = p.owner';
/* A post's row: its text cut to the first 280 characters, which is more
   than the two lines the page shows of it. */
const COMMUNITY_CARD =
  'p.id, p.owner, p.title, substr(p.body, 1, 280) AS lead, p.created_at, p.edited_at, ' +
  'p.score, p.comments, p.last_comment_at, p.gone, u.username AS author';

/* A page of posts, each way and in each order: on idx_azeri_posts_new by
   (created_at, id), and on idx_azeri_posts_top by (week, score, created_at,
   id). PAGE + 1 rows, the last only to say whether there is another page.
   A post its author deleted stays among the newest, where its comments are
   still read, and is left out of Top, where an empty row heading the week on
   the upvotes it had would be the one thing there not worth reading — the
   rows it costs to skip are the week's deleted ones. */
const COMMUNITY_NEWEST =
  'SELECT ' + COMMUNITY_CARD + ' FROM azeri_posts p ' + COMMUNITY_POSTER + ' WHERE (p.created_at, p.id) < (?, ?) ORDER BY p.created_at DESC, p.id DESC LIMIT ' + (PAGE + 1);
const COMMUNITY_NEWER =
  'SELECT ' + COMMUNITY_CARD + ' FROM azeri_posts p ' + COMMUNITY_POSTER + ' WHERE (p.created_at, p.id) > (?, ?) ORDER BY p.created_at, p.id LIMIT ' + (PAGE + 1);
const COMMUNITY_TOPMOST =
  'SELECT ' + COMMUNITY_CARD + ' FROM azeri_posts p ' + COMMUNITY_POSTER + ' WHERE p.week = ? AND (p.score, p.created_at, p.id) < (?, ?, ?) AND p.gone = 0 ' +
  'ORDER BY p.score DESC, p.created_at DESC, p.id DESC LIMIT ' + (PAGE + 1);
const COMMUNITY_HIGHER =
  'SELECT ' + COMMUNITY_CARD + ' FROM azeri_posts p ' + COMMUNITY_POSTER + ' WHERE p.week = ? AND (p.score, p.created_at, p.id) > (?, ?, ?) AND p.gone = 0 ' +
  'ORDER BY p.score, p.created_at, p.id LIMIT ' + (PAGE + 1);

/* Which of a page's posts the member upvoted: the ids as VALUES joined to
   the votes' key, so a post they did not upvote reads nothing — **The rules
   of a read** in the /api skill says why not an IN over JSON. PAGE of them,
   the last filled up with NULLs. */
const COMMUNITY_VOTED =
  'SELECT v.post FROM (VALUES ' +
  '(?), (?), (?), (?), (?), (?), (?), (?), (?), (?), ' +
  '(?), (?), (?), (?), (?), (?), (?), (?), (?), (?)' +
  ') x CROSS JOIN azeri_votes v ON v.owner = ? AND v.post = x.column1 AND v.n = 0';

/* A page of a post's comments after the n-th, on the key, with the name of
   whoever wrote each and of whoever wrote the one it answers. */
const COMMUNITY_THREAD =
  'SELECT c.n, c.owner, c.body, c.reply_to, c.created_at, c.edited_at, c.score, c.gone, ' +
  'u.username AS author, r.gone AS reply_gone, ru.username AS reply_author ' +
  'FROM azeri_comments c LEFT JOIN users u ON u.id = c.owner ' +
  'LEFT JOIN azeri_comments r ON r.post = c.post AND r.n = c.reply_to ' +
  'LEFT JOIN users ru ON ru.id = r.owner ' +
  'WHERE c.post = ? AND c.n > ? ORDER BY c.n LIMIT ' + COMMENTS;

function isMod(env, user) {
  return !!user && adminIds(env).has(String(user.id).toLowerCase());
}

/* A look at Community: what is new is what came after the visit before this
   one — VISIT_MS in ../_community.js — and the look moves the member's row,
   which is what puts out the dot on the tab. Opening the posts' first page,
   which is what the tab opens on, always writes it; turning pages and
   opening posts write it at most once a minute, so most of them write
   nothing. A first look marks nothing new: everything would be. */
async function look(env, user, opening) {
  const now = Date.now();
  const row = await env.DB
    .prepare('SELECT seen_at, prev_at FROM azeri_seen WHERE user_id = ?')
    .bind(user.id)
    .first();
  const since = !row ? now : now - row.seen_at > VISIT_MS ? row.seen_at : row.prev_at;
  if (!row || opening || now - row.seen_at > 60000) {
    await env.DB
      .prepare(
        'INSERT INTO azeri_seen (user_id, seen_at, prev_at, mine_n) VALUES (?, ?, ?, 0) ' +
        'ON CONFLICT (user_id) DO UPDATE SET seen_at = excluded.seen_at, prev_at = excluded.prev_at, mine_n = 0'
      )
      .bind(user.id, now, since)
      .run();
  }
  return since;
}

/* ------------------------------------------------------------------- GET */

export async function onRequestGet(context) {
  const { request, env } = context;
  if (!env.DB || (await wrongDatabase(env))) return json({ error: 'no-database' }, 503);
  const user = await sessionUser(request, env);
  const q = new URL(request.url).searchParams;
  if (q.has('news')) {
    return json({ user: user ? user.username : null, news: user ? await communityNews(env, user) : null });
  }
  if (!(await communityReady(env))) return json({ ready: false, user: user ? user.username : null });

  const read = (said) => (q.has('post')
    ? readPost(env, user, said, String(q.get('post')), Math.max(0, Number.parseInt(q.get('after'), 10) || 0))
    : readFeed(env, user, said, q));
  if (user) {
    const since = await look(env, user, !q.has('post') && !q.has('after') && !q.has('before'));
    const body = await read({ ready: true, user: user.username, mod: isMod(env, user), since });
    return json(body, body.error ? 404 : 200);
  }

  /* Signed out: the same answer for anybody, out of the colo for a minute. */
  const key = new Request(new URL(request.url).toString());
  const kept = await caches.default.match(key);
  if (kept) return privately(kept);
  const body = await read({ ready: true, user: null, mod: false, since: null });
  const res = json(body, body.error ? 404 : 200, ANON_TTL);
  if (!body.error) context.waitUntil(caches.default.put(key, res.clone()));
  return privately(res);
}

/* A cursor as the page writes it into its address: created_at.id, or
   score.created_at.id for Top. Null for anything else. */
function cursorOf(raw, top) {
  if (!raw) return null;
  const parts = String(raw).split('.');
  if (parts.length !== (top ? 3 : 2) || !POST_ID.test(parts[parts.length - 1])) return null;
  const nums = parts.slice(0, -1).map(Number);
  return nums.every(Number.isSafeInteger) ? [...nums, parts[parts.length - 1]] : null;
}

function cursorAt(row, top) {
  return (top ? [row.score, row.created_at, row.id] : [row.created_at, row.id]).join('.');
}

async function readFeed(env, user, said, q) {
  const top = q.get('sort') === 'top';
  const week = weekOf(Date.now());
  const head = (cursor) => (top
    ? env.DB.prepare(COMMUNITY_TOPMOST).bind(week, ...(cursor || [END, END, '']))
    : env.DB.prepare(COMMUNITY_NEWEST).bind(...(cursor || [END, ''])));

  let rows;
  let prev;
  let more;
  const before = cursorOf(q.get('before'), top);
  const after = cursorOf(q.get('after'), top);
  if (before) {
    /* The page before: the PAGE nearest the cursor going up, turned round.
       Fewer than a page above it is the first page, which is asked again
       whole rather than drawn short. */
    const up = ((await (top ? env.DB.prepare(COMMUNITY_HIGHER).bind(week, ...before) : env.DB.prepare(COMMUNITY_NEWER).bind(...before)).all()).results || []);
    if (up.length > PAGE) {
      rows = up.slice(0, PAGE).reverse();
      prev = true;
      more = true;
    }
  }
  if (!rows) {
    const down = (await head(before ? null : after).all()).results || [];
    rows = down.slice(0, PAGE);
    prev = !before && !!after;
    more = down.length > PAGE;
  }

  /* For a member, the upvotes they gave this page, and for each post
     somebody has commented on since the visit before, how many of its last
     comments are others' and that new — one batch. Signed out, neither. */
  const me = user ? user.id : null;
  const ids = rows.map((r) => r.id);
  const fresh = me ? rows.filter((r) => r.comments > 0 && r.last_comment_at > said.since) : [];
  const asks = me && rows.length ? [env.DB.prepare(COMMUNITY_VOTED).bind(...ids, ...Array(PAGE - ids.length).fill(null), me)] : [];
  for (const r of fresh) {
    asks.push(env.DB
      .prepare('SELECT owner, created_at FROM azeri_comments WHERE post = ? ORDER BY n DESC LIMIT ' + FRESH_CAP)
      .bind(r.id));
  }
  const answers = asks.length ? await env.DB.batch(asks) : [];
  const voted = new Set(((answers[0] && answers[0].results) || []).map((v) => v.post));
  const news = new Map(fresh.map((r, i) => [r.id,
    (answers[i + 1].results || []).filter((c) => c.created_at > said.since && c.owner !== me).length]));

  return {
    ...said,
    sort: top ? 'top' : 'new',
    posts: rows.map((r) => ({
      id: r.id,
      title: r.gone ? '' : r.title,
      lead: r.gone ? '' : r.lead,
      author: r.gone ? null : r.author,
      mine: r.owner === me,
      at: r.created_at,
      edited: !!r.edited_at,
      score: r.score,
      voted: voted.has(r.id),
      comments: r.comments,
      gone: r.gone,
      fresh: !!me && r.created_at > said.since && r.owner !== me,
      freshComments: news.get(r.id) || 0
    })),
    first: rows.length ? cursorAt(rows[0], top) : null,
    next: more && rows.length ? cursorAt(rows[rows.length - 1], top) : null,
    prev: !!prev
  };
}

async function readPost(env, user, said, id, after) {
  if (!POST_ID.test(id)) return { ...said, error: 'not-found' };
  const p = await env.DB
    .prepare(
      'SELECT p.id, p.owner, p.title, p.body, p.created_at, p.edited_at, p.score, p.comments, p.gone, ' +
      'u.username AS author FROM azeri_posts p ' + COMMUNITY_POSTER + ' WHERE p.id = ?'
    )
    .bind(id)
    .first();
  if (!p) return { ...said, error: 'not-found' };

  /* The page of comments, and a member's upvotes on the post and on the
     comments of that page: the votes' key by (owner, post) and a range of n
     no wider than the page, 0 — the post — included on the first. */
  const me = user ? user.id : null;
  const asks = [env.DB.prepare(COMMUNITY_THREAD).bind(id, after)];
  if (me) {
    asks.push(env.DB
      .prepare('SELECT n FROM azeri_votes WHERE owner = ? AND post = ? AND n >= ? AND n <= ?')
      .bind(me, id, after ? after + 1 : 0, after + COMMENTS));
  }
  const [thread, votes] = await env.DB.batch(asks);
  const voted = new Set(((votes && votes.results) || []).map((v) => v.n));
  const comments = (thread.results || []).map((c) => ({
    n: c.n,
    author: c.gone ? null : c.author,
    mine: c.owner === me,
    body: c.gone ? '' : c.body,
    at: c.created_at,
    edited: !!c.edited_at,
    score: c.score,
    voted: voted.has(c.n),
    replyTo: c.reply_to,
    replyAuthor: c.reply_to && !c.reply_gone ? c.reply_author : null,
    gone: c.gone,
    fresh: !!me && c.created_at > said.since && c.owner !== me
  }));
  const last = comments.length ? comments[comments.length - 1].n : after;

  return {
    ...said,
    post: {
      id: p.id,
      title: p.gone ? '' : p.title,
      body: p.gone ? '' : p.body,
      author: p.gone ? null : p.author,
      mine: p.owner === me,
      at: p.created_at,
      edited: !!p.edited_at,
      score: p.score,
      voted: voted.has(0),
      comments: p.comments,
      gone: p.gone
    },
    comments,
    more: Math.max(0, p.comments - last)
  };
}

/* ------------------------------------------------------------------ POST */

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!env.DB || (await wrongDatabase(env))) return json({ error: 'no-database' }, 503);
  const user = await sessionUser(request, env);
  if (!user) return json({ error: 'signed-out' }, 401);
  if (!(await communityReady(env))) return json({ error: 'not-ready' }, 503);
  const mod = isMod(env, user);

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return json({ error: 'bad-request' }, 400);
  }
  if (!body || typeof body !== 'object') return json({ error: 'bad-request' }, 400);

  switch (body.action) {
    case 'post': return write(env, user, body);
    case 'edit': return edit(env, user, body);
    case 'delete': return removePost(env, user, mod, body);
    case 'comment': return comment(env, user, body);
    case 'editcomment': return editComment(env, user, body);
    case 'uncomment': return removeComment(env, user, mod, body);
    case 'vote': return vote(env, user, body);
    default: return json({ error: 'bad-action' }, 400);
  }
}

/* A title is one line; a text keeps its line breaks, with no more than one
   empty line in a row and nothing at the ends. Control characters go. The
   lengths are UTF-16 units, as a field's maxlength counts them. */
function cleanTitle(raw) {
  return String(raw || '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
}

function cleanText(raw) {
  return String(raw || '')
    .replace(/\r\n?/g, '\n')
    .replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, '')
    .replace(/[ \t]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/* How many posts, or comments, the member wrote in the last day, counted
   up to the cap on the owner's index and no further. */
const COMMUNITY_POSTS_TODAY =
  'SELECT COUNT(*) AS n FROM (SELECT 1 FROM azeri_posts WHERE owner = ? AND created_at > ? LIMIT ' + POSTS_A_DAY + ')';
const COMMUNITY_COMMENTS_TODAY =
  'SELECT COUNT(*) AS n FROM (SELECT 1 FROM azeri_comments WHERE owner = ? AND created_at > ? LIMIT ' + COMMENTS_A_DAY + ')';

async function today(env, sql, user) {
  const row = await env.DB.prepare(sql).bind(user.id, Date.now() - DAY_MS).first();
  return row ? row.n : 0;
}

function postText(body) {
  const title = cleanTitle(body.title);
  const text = cleanText(body.body);
  if (!title) return { error: json({ error: 'title' }, 400) };
  if (title.length > MAX_TITLE || text.length > MAX_BODY) return { error: json({ error: 'too-long' }, 400) };
  return { title, text };
}

async function write(env, user, body) {
  const said = postText(body);
  if (said.error) return said.error;
  if ((await today(env, COMMUNITY_POSTS_TODAY, user)) >= POSTS_A_DAY) return json({ error: 'often' }, 429);
  const now = Date.now();
  const id = randomHex(5);
  await env.DB
    .prepare('INSERT INTO azeri_posts (id, owner, title, body, created_at, week) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(id, user.id, said.title, said.text, now, weekOf(now))
    .run();
  return json({ id });
}

/* The row of a post as a write needs it, or null for one that is not there. */
async function postRow(env, id) {
  if (!POST_ID.test(String(id || ''))) return null;
  return env.DB.prepare('SELECT owner, comments, gone FROM azeri_posts WHERE id = ?').bind(id).first();
}

async function edit(env, user, body) {
  const row = await postRow(env, body.id);
  if (!row || row.owner !== user.id || row.gone) return json({ error: 'not-found' }, 404);
  const said = postText(body);
  if (said.error) return said.error;
  await env.DB
    .prepare('UPDATE azeri_posts SET title = ?, body = ?, edited_at = ? WHERE id = ? AND owner = ?')
    .bind(said.title, said.text, Date.now(), body.id, user.id)
    .run();
  return json({ id: body.id });
}

/* The author's delete keeps a post that has comments under it, emptied, so
   the conversation still has its first line; one with none goes. The site's
   owner taking somebody else's down takes all of it — the post, its
   comments and the upvotes on them. */
async function removePost(env, user, mod, body) {
  const id = body.id;
  const row = await postRow(env, id);
  if (!row) return json({ error: 'not-found' }, 404);
  const mine = row.owner === user.id;
  if (!mine && !mod) return json({ error: 'not-found' }, 404);
  if (!mine || row.comments === 0) {
    await env.DB.batch([
      env.DB.prepare('DELETE FROM azeri_votes WHERE post = ?').bind(id),
      env.DB.prepare('DELETE FROM azeri_comments WHERE post = ?').bind(id),
      env.DB.prepare('DELETE FROM azeri_posts WHERE id = ?').bind(id)
    ]);
  } else {
    await env.DB
      .prepare("UPDATE azeri_posts SET title = '', body = '', gone = 1 WHERE id = ? AND owner = ?")
      .bind(id, user.id)
      .run();
  }
  return json({ ok: true });
}

/* A comment is the post's next n, worked out inside the batch that writes
   it, so two at once cannot take the same one; the post's count is then
   recomputed from the comments — the last n, one row off the end of the
   key, which is what the ORDER BY … LIMIT 1 says where a MAX() would leave
   it to the planner. Somebody commenting on
   another member's post adds to that member's count of what is new for
   them, which lights the dot on their tab. */
async function comment(env, user, body) {
  const text = cleanText(body.body);
  if (!text) return json({ error: 'empty' }, 400);
  if (text.length > MAX_COMMENT) return json({ error: 'too-long' }, 400);
  const id = body.post;
  const row = await postRow(env, id);
  if (!row) return json({ error: 'not-found' }, 404);
  if (row.gone) return json({ error: 'gone' }, 409);
  if ((await today(env, COMMUNITY_COMMENTS_TODAY, user)) >= COMMENTS_A_DAY) return json({ error: 'often' }, 429);

  const replyTo = Number.isInteger(body.replyTo) && body.replyTo >= 1 && body.replyTo <= row.comments ? body.replyTo : null;
  const now = Date.now();
  const writes = [
    env.DB
      .prepare(
        'INSERT INTO azeri_comments (post, n, owner, body, reply_to, created_at) ' +
        'SELECT p.id, COALESCE((SELECT c.n FROM azeri_comments c WHERE c.post = p.id ORDER BY c.n DESC LIMIT 1), 0) + 1, ?, ?, ?, ? ' +
        'FROM azeri_posts p WHERE p.id = ? AND p.gone = 0'
      )
      .bind(user.id, text, replyTo, now, id),
    env.DB
      .prepare(
        'UPDATE azeri_posts SET comments = COALESCE((SELECT n FROM azeri_comments WHERE post = ? ORDER BY n DESC LIMIT 1), 0), ' +
        'last_comment_at = ? WHERE id = ?'
      )
      .bind(id, now, id),
    env.DB.prepare('SELECT comments FROM azeri_posts WHERE id = ?').bind(id)
  ];
  if (row.owner !== user.id) {
    writes.push(env.DB
      .prepare(
        'INSERT INTO azeri_seen (user_id, mine_at, mine_n) VALUES (?, ?, 1) ' +
        'ON CONFLICT (user_id) DO UPDATE SET mine_at = excluded.mine_at, mine_n = mine_n + 1'
      )
      .bind(row.owner, now));
  }
  const [made, , counted] = await env.DB.batch(writes);
  if (!made.meta || !made.meta.changes) return json({ error: 'gone' }, 409);
  const n = counted.results && counted.results[0] ? counted.results[0].comments : row.comments + 1;
  return json({
    comment: {
      n, author: user.username, mine: true, body: text, at: now, edited: false, score: 0, voted: false,
      replyTo, replyAuthor: null, gone: 0, fresh: false
    }
  });
}

/* The row of a comment as a write needs it, or null. */
async function commentRow(env, body) {
  const n = body.n;
  if (!POST_ID.test(String(body.post || '')) || !Number.isInteger(n) || n < 1) return null;
  return env.DB.prepare('SELECT owner, gone FROM azeri_comments WHERE post = ? AND n = ?').bind(body.post, n).first();
}

async function editComment(env, user, body) {
  const row = await commentRow(env, body);
  if (!row || row.owner !== user.id || row.gone) return json({ error: 'not-found' }, 404);
  const text = cleanText(body.body);
  if (!text) return json({ error: 'empty' }, 400);
  if (text.length > MAX_COMMENT) return json({ error: 'too-long' }, 400);
  await env.DB
    .prepare('UPDATE azeri_comments SET body = ?, edited_at = ? WHERE post = ? AND n = ?')
    .bind(text, Date.now(), body.post, body.n)
    .run();
  return json({ ok: true });
}

/* A comment deleted or taken down is emptied and kept: its n is what the
   replies to it name. */
async function removeComment(env, user, mod, body) {
  const row = await commentRow(env, body);
  if (!row || row.gone) return json({ error: 'not-found' }, 404);
  const mine = row.owner === user.id;
  if (!mine && !mod) return json({ error: 'not-found' }, 404);
  await env.DB
    .prepare("UPDATE azeri_comments SET body = '', gone = ? WHERE post = ? AND n = ?")
    .bind(mine ? 1 : 2, body.post, body.n)
    .run();
  return json({ ok: true });
}

/* An upvote on, or off again. One row a member and thing, so pressing twice
   counts once, and the score is counted again from the rows in the same
   batch — on idx_azeri_votes_on, the upvotes of that one thing. */
async function vote(env, user, body) {
  const n = body.n;
  const row = n === 0 ? await postRow(env, body.post) : await commentRow(env, body);
  if (!row || row.gone) return json({ error: 'not-found' }, 404);
  if (row.owner === user.id) return json({ error: 'own' }, 403);
  const id = body.post;
  const on = body.on === true;
  const [, , scored] = await env.DB.batch([
    on
      ? env.DB.prepare('INSERT OR IGNORE INTO azeri_votes (owner, post, n) VALUES (?, ?, ?)').bind(user.id, id, n)
      : env.DB.prepare('DELETE FROM azeri_votes WHERE owner = ? AND post = ? AND n = ?').bind(user.id, id, n),
    n === 0
      ? env.DB.prepare('UPDATE azeri_posts SET score = (SELECT COUNT(*) FROM azeri_votes WHERE post = ? AND n = 0) WHERE id = ?').bind(id, id)
      : env.DB.prepare('UPDATE azeri_comments SET score = (SELECT COUNT(*) FROM azeri_votes WHERE post = ? AND n = ?) WHERE post = ? AND n = ?').bind(id, n, id, n),
    n === 0
      ? env.DB.prepare('SELECT score FROM azeri_posts WHERE id = ?').bind(id)
      : env.DB.prepare('SELECT score FROM azeri_comments WHERE post = ? AND n = ?').bind(id, n)
  ]);
  const score = scored.results && scored.results[0] ? scored.results[0].score : 0;
  return json({ score, voted: on });
}
