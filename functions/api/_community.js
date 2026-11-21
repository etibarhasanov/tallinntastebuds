/**
 * Tallinn Tastebuds — what the Azerbaijani Corner's Community shares with
 * the rest of the site.
 *
 * The route is functions/api/azeri/community.js and it is the only thing that
 * writes the four tables. What is here is what is not the route's alone: the
 * caps and the week, which the route and the page both hold to; the answer
 * to whether there is something new, communityNews(); and forgetMember(),
 * which /api/account calls to wipe a member's words when the account is
 * deleted. **Community** under **The Azerbaijani corner** in
 * docs/handbook.md.
 */

/* The caps, restated in assets/azeri.js for the counters and the fields'
   maxlength. Characters of text, not of JSON. A post is a title and as much
   as a long message; a comment is a reply. Five posts and fifty comments a
   day an account: a community, not a feed a script can fill. */
export const MAX_TITLE = 120;
export const MAX_BODY = 5000;
export const MAX_COMMENT = 2000;
export const POSTS_A_DAY = 5;
export const COMMENTS_A_DAY = 50;

/* A visit: a look at Community that comes more than this long after the last
   one starts a new visit, and what is marked new is what came after the
   visit before. Half an hour is long enough to open five posts and come back
   to the list, and short enough that the marks are gone by the evening. */
export const VISIT_MS = 30 * 60 * 1000;

/* As many new posts as the tab's number counts before it says 9+. The count
   reads that many rows at most, whoever has been away for how long. */
export const NEWS_CAP = 10;

/* The week a moment is in, Monday to Sunday in Tallinn, numbered from the
   week of Monday 5 January 1970: day 0, 1 January, was a Thursday, so three
   days on is the Sunday that week 0 ends on. sv-SE is the locale whose date
   reads YYYY-MM-DD. */
export function weekOf(ms) {
  const day = new Date(ms).toLocaleDateString('sv-SE', { timeZone: 'Europe/Tallinn' });
  const [y, m, d] = day.split('-').map(Number);
  return Math.floor((Date.UTC(y, m - 1, d) / 86400000 + 3) / 7);
}

/* Whether the four tables are in this database, asked once per isolate. They
   reach a database by hand, after the deploy that reads them, and until then
   the tab says it could not load and the others carry no dot. */
let ready = null;

export async function communityReady(env) {
  if (ready === true) return true;
  try {
    await env.DB.prepare('SELECT 1 FROM azeri_posts LIMIT 1').first();
    await env.DB.prepare('SELECT 1 FROM azeri_seen LIMIT 1').first();
    ready = true;
  } catch (e) {
    ready = false;
  }
  return ready;
}

/* What lights the dot on the Community tab while a member reads another tab
   of the corner, and the number in the browser's tab: the posts by others
   since they last opened Community, up to NEWS_CAP, and the comments on posts
   of theirs since then. Null where the tables are not there yet, which draws
   no dot.

   Two statements. Their own row, by its key: one row. And the newest posts
   after that moment on idx_azeri_posts_new, stopping at NEWS_CAP that are not
   theirs: ten rows, and as many more as they posted themselves in the time,
   which POSTS_A_DAY keeps to a handful. The page asks once each time a tab
   of the corner is shown, through the route's ?news=1, and not on every page
   of the films. */
export async function communityNews(env, user) {
  if (!(await communityReady(env))) return null;
  try {
    const seen = await env.DB
      .prepare('SELECT seen_at, mine_at, mine_n FROM azeri_seen WHERE user_id = ?')
      .bind(user.id)
      .first();
    const since = seen ? seen.seen_at : 0;
    const posts = await env.DB
      .prepare(
        'SELECT COUNT(*) AS n FROM (SELECT 1 FROM azeri_posts ' +
        'WHERE created_at > ? AND owner != ? ORDER BY created_at DESC LIMIT ' + NEWS_CAP + ')'
      )
      .bind(since, user.id)
      .first();
    const mine = seen && seen.mine_at > since ? seen.mine_n : 0;
    return { posts: posts ? posts.n : 0, mine };
  } catch (e) {
    return null;
  }
}

/* A deleted account's words, out of Community. Its posts with nobody's
   comments under them go; the rest, and every comment it wrote, are emptied
   and kept, so a conversation it was part of still reads in order with a
   line where it spoke. Its upvotes stay as numbers with nobody behind them,
   and its own row goes. After the account's own batch and on its own, as
   the walks' are: the tables reach a database by hand, and the account is
   already gone either way. */
export async function forgetMember(env, id) {
  if (!(await communityReady(env))) return;
  try {
    await env.DB.batch([
      env.DB.prepare('DELETE FROM azeri_posts WHERE owner = ? AND comments = 0').bind(id),
      env.DB.prepare("UPDATE azeri_posts SET title = '', body = '', gone = 1 WHERE owner = ?").bind(id),
      env.DB.prepare("UPDATE azeri_comments SET body = '', gone = 1 WHERE owner = ? AND gone = 0").bind(id),
      env.DB.prepare('DELETE FROM azeri_seen WHERE user_id = ?').bind(id)
    ]);
  } catch (e) { /* nothing more to do: the account is gone */ }
}
