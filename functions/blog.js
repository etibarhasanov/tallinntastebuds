/**
 * Tallinn Tastebuds — /blog, and every /blog?post=<id> on it.
 *
 * blog.html again, with a head of its own and the post written into it as
 * text. Until this file existed the blog was the one page on the site written
 * to be found that nothing could find: the posts were drawn by assets/blog.js
 * into an empty <main>, the head said "Notes on the map" at every address, and
 * a crawler that runs no script — Bing on many of its visits, Yandex on most,
 * and every assistant that fetches a page to read it — got an empty page
 * under the index's title whichever post it had been sent to. Google, which
 * does run the script, got the post's words and the index's head, which is a
 * search result titled "Notes on the map" over a paragraph about bakeries.
 *
 * What this buys, in the order it matters:
 *
 *   a search finds   the post — its title, its standfirst and every paragraph,
 *                    as text, and the same as a BlogPosting in JSON-LD
 *   a link unfurls   as the post, rather than as the blog
 *   the page draws   the same as it always did: assets/blog.js empties <main>
 *                    before it draws, so nobody sees what went in here
 *
 * The comment in the head of blog.html used to say this was not worth a route
 * — a nicer preview card was all it bought, and nothing on the page is written
 * by a stranger or private. That was right while every post was about the site
 * itself. It stopped being right when the blog started carrying posts about
 * where to eat, which are the pages on this site most likely to be what
 * somebody typed; see **Found as text** under **The blog** in README.md.
 *
 * IN ENGLISH, WHATEVER THE LINK ASKED FOR
 *
 * A post is required in English and welcome in anything else, and one address
 * is one page: the head, the text and the JSON-LD are the English, for the
 * argument functions/list/[id].js makes at length — what is written in here
 * is for the reader that runs no script, which is a crawler asking for the
 * page rather than for a language. The script still draws a post in the
 * reader's own language where it has been written in it.
 *
 * LINKS INSIDE A POST
 *
 * A paragraph may carry [words](/path) — a link to somewhere on this site, and
 * nowhere else. It is the one piece of markup a post has, drawn the same way
 * here and in assets/blog.js, and tools/validate.mjs holds every one to a path
 * on this site and every ?spot= among them to a place that is on the map. They
 * are the point of the posts about food: a paragraph about bakeries that
 * cannot send anybody to the bakery, or to the list somebody made of them, is
 * a paragraph with nowhere to go.
 *
 * AND EVERYBODY ELSE'S
 *
 * /blog?post=<id> is also the address of a post a member wrote on /write,
 * which lives in the database rather than in data/blog.json — see
 * functions/api/posts.js. Such a post gets the same treatment: its title,
 * standfirst, canonical and card in the head, a BlogPosting whose author is
 * the person and whose page is their profile, and the post as text, in the
 * language it was first written in, since that is the one it is whole in.
 * A draft is nobody's to index and is not read here at all. /blog?by=<name>
 * is one person's posts, a page of them as text under their name. And the
 * index lists the newest page of members' posts after the house's, so a
 * crawler that reads only the index finds those too; /blog/sitemap is the
 * rest of them, every published post's address — functions/blog/sitemap.js.
 *
 * WHAT HAPPENS WHEN IT CANNOT
 *
 * The untouched page, and assets/blog.js draws it as it always has. A missing
 * or malformed data/blog.json and a ?post= that names nothing both get the
 * page's own head; the second gets a noindex as well, since what a crawler
 * would file there is the index under an address that is not the index's.
 * A database that cannot be read is a blog of the house's notes, as it was
 * before anybody else could write in it.
 */

import { canonical, esc, head, seed, shell, rehead, fill, EMPTY, page, SITE } from './_shell.js';
import { dataFile, wrongDatabase, venuesByIds } from './api/_lib.js';
import { POST_ID, readPage, readPost, postsReady, pickText, bodyHtml, plainText } from './api/_posts.js';
import { asUsername } from './api/_account.js';

const PATH = '/blog';
const FILE = '/blog.html';
const POSTS_FILE = '/data/blog.json';
const DEFAULT_LANG = 'en';

/* What the index calls itself and says about itself, which is also what the
   static head of blog.html says: this route writes the same words over them,
   so an index served here and blog.html opened directly agree. */
const TITLE = 'Notes on the map';
const DESCRIPTION =
  'Where to eat in Tallinn, and why the map works the way it does: bakeries, ' +
  'craft beer, cheap eats, Georgian and Azerbaijani food, Google\'s top tens, ' +
  'and one post for each thing this site does.';

/* A post id as data/blog.json spells one — the validator's SLUG. Anything
   else is nothing, and is not looked up. */
const WRITTEN = /^[a-z0-9][a-z0-9-]{0,95}$/;

/* The one piece of markup a post carries — see LINKS INSIDE A POST. The path
   must start with a single slash: "//host" is a link to somebody else's site
   dressed as one to this one. assets/blog.js carries the same pattern. */
const LINK = /\[([^\]]+)\]\((\/(?!\/)[^)\s]*)\)/g;

function inEnglish(pack) {
  return (pack && pack[DEFAULT_LANG]) || '';
}

/* A paragraph, escaped, with its links made links. Pieced together rather
   than run through String.replace, for the reason sow() in ./_shell.js gives:
   a dollar sign in a paragraph is a dollar sign. The validator holds every
   paragraph to a string. */
function prose(text) {
  const out = [];
  let at = 0;
  for (const m of String(text).matchAll(LINK)) {
    out.push(esc(text.slice(at, m.index)));
    out.push('<a href="' + esc(m[2]) + '">' + esc(m[1]) + '</a>');
    at = m.index + m[0].length;
  }
  out.push(esc(text.slice(at)));
  return out.join('');
}

/* The same paragraph with the markup taken off, for the places a link cannot
   go: a description, the JSON-LD. */
function plain(text) {
  return String(text).replace(LINK, (whole, words) => words);
}

/* Newest first, the order the page draws them in. Sorted here rather than
   trusted from the file, for the reason assets/blog.js gives. */
async function postsOf(context) {
  try {
    const file = await dataFile(context, POSTS_FILE);
    return (Array.isArray(file) ? file : [])
      .filter((p) => p && WRITTEN.test(p.id || '') && inEnglish(p.title))
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  } catch (e) {
    return [];
  }
}

function postPath(post) {
  return PATH + '?post=' + post.id;
}

/* One row of the index as text: the title as a link, the date, and the line
   under it. */
function row(post) {
  return '<li><h2><a href="' + esc(postPath(post)) + '">' + esc(inEnglish(post.title)) + '</a></h2>' +
    '<p><time datetime="' + esc(post.date) + '">' + esc(post.date) + '</time> — ' +
    esc(inEnglish(post.standfirst)) + '</p></li>';
}

function indexWords(posts, members) {
  return '<h1>' + esc(TITLE) + '</h1><p>' + esc(DESCRIPTION) + '</p>' +
    '<ol>' + posts.map(row).join('') + '</ol>' +
    (members.length ? '<h2>Written by members</h2><ol>' + members.map(memberRow).join('') + '</ol>' : '') +
    '<p><a href="/">The map of Tallinn</a> · <a href="/lists">Lists</a></p>';
}

/* ------------------------------------------------------- members' posts */

/* The database, or null where it cannot be read or the two tables are not
   there yet — and then the blog is the house's notes alone. */
async function members(env) {
  try {
    if (!env.DB || (await wrongDatabase(env)) || !(await postsReady(env))) return null;
    return env;
  } catch (e) {
    return null;
  }
}

function memberDate(post) {
  return new Date(post.at).toISOString().slice(0, 10);
}

/* A member's post in the language it was first written in. */
function firstText(post) {
  return pickText(post.texts, post.lang, post.lang) || { title: '', standfirst: '' };
}

function memberRow(post) {
  const text = firstText(post);
  return '<li><h2><a href="' + esc(postPath(post)) + '">' + esc(text.title) + '</a></h2>' +
    '<p><time datetime="' + esc(memberDate(post)) + '">' + esc(memberDate(post)) + '</time> — by ' +
    '<a href="/u/' + esc(encodeURIComponent(post.author)) + '">' + esc(post.author) + '</a>' +
    (text.standfirst ? ' — ' + esc(text.standfirst) : '') + '</p></li>';
}

function memberWords(post, names, lists) {
  const text = firstText(post);
  return '<article lang="' + esc(post.lang) + '">' +
    '<h1>' + esc(text.title) + '</h1>' +
    '<p><time datetime="' + esc(memberDate(post)) + '">' + esc(memberDate(post)) + '</time> — by ' +
    '<a href="/u/' + esc(encodeURIComponent(post.author)) + '">' + esc(post.author) + '</a></p>' +
    (text.standfirst ? '<p>' + esc(text.standfirst) + '</p>' : '') +
    bodyHtml(text.body, esc, (id) => names.get(id) || '', (id) => lists.get(id) || null) +
    '</article>' +
    '<p><a href="' + esc(PATH + '?by=' + encodeURIComponent(post.author)) + '">More by ' + esc(post.author) + '</a> · ' +
    '<a href="' + PATH + '">' + esc(TITLE) + '</a> · <a href="/">The map of Tallinn</a></p>';
}

function authorWords(name, list) {
  return '<h1>Posts by ' + esc(name) + '</h1>' +
    '<p><a href="/u/' + esc(encodeURIComponent(name)) + '">' + esc(name) + '</a></p>' +
    '<ol>' + list.map(memberRow).join('') + '</ol>' +
    '<p><a href="' + PATH + '">' + esc(TITLE) + '</a> · <a href="/">The map of Tallinn</a></p>';
}

function memberPosting(request, post) {
  const self = canonical(request, postPath(post));
  const text = firstText(post);
  const person = SITE + '/u/' + encodeURIComponent(post.author);
  return {
    '@context': 'https://schema.org',
    '@graph': [
      PUBLISHER,
      {
        '@type': 'BlogPosting',
        '@id': self + '#post',
        url: self,
        mainEntityOfPage: self,
        headline: text.title,
        description: text.standfirst || undefined,
        datePublished: new Date(post.published || post.at).toISOString(),
        dateModified: new Date(post.updated || post.at).toISOString(),
        inLanguage: post.lang,
        image: SITE + '/assets/logo/og.jpg',
        author: { '@type': 'Person', name: post.author, url: person },
        publisher: { '@id': SITE + '#org' },
        isPartOf: { '@id': canonical(request, PATH) + '#blog' },
        wordCount: plainText(text.body).split(/\s+/).filter(Boolean).length
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Tallinn Tastebuds', item: SITE + '/' },
          { '@type': 'ListItem', position: 2, name: TITLE, item: canonical(request, PATH) },
          { '@type': 'ListItem', position: 3, name: text.title }
        ]
      }
    ]
  };
}

/* The places a post's cards name, by id, for the name on each card: the
   map's out of data/map.json, and whichever are Google's venues out of the
   export, asked for by the ids this one body carries and nothing more. A
   database that cannot answer costs those cards their line and nothing else. */
async function placeNames(context, blocks) {
  let names;
  try {
    const list = await dataFile(context, '/data/map.json');
    names = new Map((Array.isArray(list) ? list : []).map((p) => [p.id, p.name]));
  } catch (e) {
    names = new Map();
  }
  const rest = [...new Set((blocks || [])
    .filter((b) => b && b.k === 'place' && !names.has(b.id))
    .map((b) => b.id))];
  for (let i = 0; i < rest.length; i += 50) {
    const found = await venuesByIds(context.env, rest.slice(i, i + 50)).catch(() => new Map());
    for (const [id, venue] of found) names.set(id, venue.name);
  }
  return names;
}

/* The lists a post carries, for the readers that run no script: the title,
   whose it is, and the places on it by the names the list stored — which is
   all a crawler needs to know the post is about them, and is two reads
   however many lists there are. Public ones only, asked now rather than
   trusted from when the post was written: a list made private since leaves
   the post's text the way it leaves the page. A database that cannot answer
   costs the post its lists and nothing else. */
async function listsOf(env, blocks) {
  const ids = [...new Set((blocks || []).filter((b) => b && b.k === 'list').map((b) => b.id))];
  const out = new Map();
  if (!ids.length || !env.DB) return out;
  try {
    const marks = ids.map(() => '?').join(',');
    const heads = await env.DB
      .prepare('SELECT l.id AS id, l.title AS title, u.username AS by FROM lists l ' +
        'LEFT JOIN users u ON u.id = l.owner WHERE l.public = 1 AND l.id IN (' + marks + ')')
      .bind(...ids)
      .all();
    for (const r of heads.results || []) out.set(r.id, { title: r.title, by: r.by || '', names: [] });
    if (!out.size) return out;
    const items = await env.DB
      .prepare('SELECT list_id, name FROM list_items WHERE list_id IN (' + marks + ') ORDER BY list_id, pos')
      .bind(...ids)
      .all();
    for (const r of items.results || []) if (out.has(r.list_id)) out.get(r.list_id).names.push(r.name);
  } catch (e) {
    out.clear();
  }
  return out;
}

async function memberPage(context, html, db, asked) {
  const { request } = context;
  const post = await readPost(db, asked, null).catch(() => null);
  if (!post) return page(html, 200, false);

  const text = firstText(post);
  const tags = head({
    title: text.title,
    description: text.standfirst || plainText(text.body).slice(0, 200),
    url: canonical(request, postPath(post)),
    type: 'article'
  }) +
    '\n<meta property="article:published_time" content="' + esc(new Date(post.published || post.at).toISOString()) + '">' +
    '\n<meta property="article:author" content="' + esc(SITE + '/u/' + encodeURIComponent(post.author)) + '">' +
    '\n<script type="application/ld+json">' + seed(memberPosting(request, post)) + '</script>';

  const body = firstText(post).body;
  const words = memberWords(post, await placeNames(context, body), await listsOf(db, body));
  return page(fill(rehead(html, tags), EMPTY[FILE.slice(1)], words), 200, true);
}

async function authorPage(context, html, db, by) {
  const { request } = context;
  const name = asUsername(by);
  if (!name) return page(html, 200, false);
  const list = await readPage(db, "p.status = 'published' AND u.username = ? COLLATE NOCASE", [name], null)
    .catch(() => ({ posts: [] }));
  /* The name as the person spelled it, off their first post where there is
     one; nobody's posts is a page not worth filing. */
  const shown = list.posts.length ? list.posts[0].author : name;
  const tags = head({
    title: 'Posts by ' + shown,
    description: 'What ' + shown + ' has written about eating in Tallinn.',
    url: canonical(request, PATH + '?by=' + encodeURIComponent(shown)),
    type: 'website'
  });
  return page(fill(rehead(html, tags), EMPTY[FILE.slice(1)], authorWords(shown, list.posts)), 200, list.posts.length > 0);
}

/* One post as text, and then every other post as a link — so a crawler that
   arrived on one post walks to the rest rather than treating it as a leaf,
   the bargain the map's text strikes with its places. */
function postWords(post, posts) {
  const body = Array.isArray(post.body && post.body.en) ? post.body.en : [];
  const others = posts.filter((p) => p !== post);
  return '<article>' +
    '<h1>' + esc(inEnglish(post.title)) + '</h1>' +
    '<p><time datetime="' + esc(post.date) + '">' + esc(post.date) + '</time></p>' +
    '<p>' + esc(inEnglish(post.standfirst)) + '</p>' +
    body.map((para) => '<p>' + prose(para) + '</p>').join('') +
    (post.link ? '<p><a href="' + esc(post.link) + '">Go and see it on the site</a></p>' : '') +
    '</article>' +
    (others.length ? '<h2>More notes</h2><ul>' +
      others.map((p) => '<li><a href="' + esc(postPath(p)) + '">' + esc(inEnglish(p.title)) + '</a></li>').join('') +
      '</ul>' : '') +
    '<p><a href="' + PATH + '">' + esc(TITLE) + '</a> · <a href="/">The map of Tallinn</a></p>';
}

/* ------------------------------------------------------- what it is, in JSON
 *
 * The site, the blog, and either one post as a BlogPosting or the index as a
 * list of them. The author is the site rather than a person: the posts are
 * written in the first person by whoever keeps the map, and naming them is
 * theirs to do, not this file's. The picture is the post's clip where it has
 * one — the still, which is a picture of the thing the post is about — and the
 * site's card where it has not. */
const PUBLISHER = {
  '@type': 'Organization',
  '@id': SITE + '#org',
  name: 'Tallinn Tastebuds',
  url: SITE,
  logo: { '@type': 'ImageObject', url: SITE + '/assets/logo/icon-192.png' }
};

function posting(request, post) {
  const self = canonical(request, postPath(post));
  const body = Array.isArray(post.body && post.body.en) ? post.body.en : [];
  return {
    '@type': 'BlogPosting',
    '@id': self + '#post',
    url: self,
    mainEntityOfPage: self,
    headline: inEnglish(post.title),
    description: inEnglish(post.standfirst),
    datePublished: post.date,
    inLanguage: DEFAULT_LANG,
    image: SITE + (post.clip ? '/clips/' + post.id + '-still.png' : '/assets/logo/og.jpg'),
    author: { '@id': SITE + '#org' },
    publisher: { '@id': SITE + '#org' },
    isPartOf: { '@id': canonical(request, PATH) + '#blog' },
    wordCount: body.map(plain).join(' ').split(/\s+/).filter(Boolean).length
  };
}

function structuredData(request, posts, post) {
  const blog = canonical(request, PATH);
  const site = { '@type': 'WebSite', '@id': SITE + '#website', url: SITE, name: 'Tallinn Tastebuds' };
  const shelf = {
    '@type': 'Blog',
    '@id': blog + '#blog',
    url: blog,
    name: TITLE,
    description: DESCRIPTION,
    inLanguage: DEFAULT_LANG,
    publisher: { '@id': SITE + '#org' },
    isPartOf: { '@id': SITE + '#website' }
  };

  if (post) {
    return {
      '@context': 'https://schema.org',
      '@graph': [
        site, PUBLISHER, shelf, posting(request, post),
        {
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Tallinn Tastebuds', item: SITE + '/' },
            { '@type': 'ListItem', position: 2, name: TITLE, item: blog },
            { '@type': 'ListItem', position: 3, name: inEnglish(post.title) }
          ]
        }
      ]
    };
  }

  return {
    '@context': 'https://schema.org',
    '@graph': [
      site, PUBLISHER,
      { ...shelf, blogPost: posts.map((p) => posting(request, p)) }
    ]
  };
}

export async function onRequest(context) {
  const { request } = context;

  let html;
  try {
    html = await shell(context, FILE);
  } catch (e) {
    return context.next();
  }

  const posts = await postsOf(context);
  const query = new URL(request.url).searchParams;
  const asked = query.get('post');
  const post = asked && WRITTEN.test(asked) ? posts.find((p) => p.id === asked) || null : null;

  const db = await members(context.env);
  if (db && !post && asked && POST_ID.test(asked)) return memberPage(context, html, db, asked);
  if (db && !asked && query.get('by')) return authorPage(context, html, db, query.get('by'));

  if (!posts.length) return page(html, 200, true);

  /* A ?post= that names nothing: the page draws the index with a sentence
     over it saying the post is not here any more, and that is not a page
     worth filing under this address. */
  if (asked && !post) return page(html, 200, false);

  const tags = post
    ? head({
        title: inEnglish(post.title),
        description: plain(inEnglish(post.standfirst)),
        url: canonical(request, postPath(post)),
        /* The site's card rather than the clip's still: head() tells an
           unfurler the picture is 1200 by 630, which the card is and a
           960 by 540 clip is not, and a wrong hint is worse than none. */
        type: 'article'
      }) +
      '\n<meta property="article:published_time" content="' + esc(post.date) + '">'
    : head({
        title: TITLE,
        description: DESCRIPTION,
        url: canonical(request, PATH),
        type: 'website'
      });

  const said = tags + '\n<script type="application/ld+json">' +
    seed(structuredData(request, posts, post)) + '</script>';

  const newest = !post && db ? (await readPage(db, "p.status = 'published'", [], null).catch(() => ({ posts: [] }))).posts : [];
  return page(fill(rehead(html, said), EMPTY[FILE.slice(1)], post ? postWords(post, posts) : indexWords(posts, newest)), 200, true);
}
