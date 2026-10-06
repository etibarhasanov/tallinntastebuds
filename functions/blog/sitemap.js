/**
 * Tallinn Tastebuds — /blog/sitemap, every member's published post.
 *
 * sitemap.xml is written by tools/sitemap.mjs out of the repository and
 * names the house's posts one by one. The posts members write live in the
 * database and arrive whenever somebody presses Publish, so no file in the
 * repository can name them; this does, on every request, and robots.txt
 * points a crawler at it beside the other. A post's <lastmod> is the last
 * time it was saved, which is what a crawler wants to know before it reads
 * the page again.
 *
 * Read out of the database a thousand at a time is not a thing this needs
 * yet: MAX_POSTS per account and the pace people write at put the whole
 * table well inside one answer for a long while, and the cap of five
 * thousand below is where it would need pages of its own. An unreadable
 * database is an empty sitemap, which is true.
 */

import { wrongDatabase } from '../api/_lib.js';
import { postsReady } from '../api/_posts.js';
import { canonical } from '../_shell.js';

const MOST = 5000;

export async function onRequestGet(context) {
  const { request, env } = context;
  let rows = [];
  try {
    if (env.DB && !(await wrongDatabase(env)) && (await postsReady(env))) {
      const got = await env.DB
        .prepare("SELECT id, updated_at FROM posts WHERE status = 'published' ORDER BY published_at DESC LIMIT ?")
        .bind(MOST)
        .all();
      rows = got.results || [];
    }
  } catch (e) {
    rows = [];
  }

  const base = canonical(request, '/blog?post=');
  const xml = '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    rows.map((r) => '  <url><loc>' + base + r.id + '</loc><lastmod>' +
      new Date(r.updated_at).toISOString().slice(0, 10) + '</lastmod></url>').join('\n') +
    (rows.length ? '\n' : '') + '</urlset>\n';

  return new Response(xml, {
    headers: {
      'content-type': 'application/xml; charset=utf-8',
      'cache-control': 'public, max-age=3600'
    }
  });
}
