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
 * WHAT HAPPENS WHEN IT CANNOT
 *
 * The untouched page, and assets/blog.js draws it as it always has. A missing
 * or malformed data/blog.json and a ?post= that names nothing both get the
 * page's own head; the second gets a noindex as well, since what a crawler
 * would file there is the index under an address that is not the index's.
 */

import { canonical, esc, head, seed, shell, rehead, fill, EMPTY, page, SITE } from './_shell.js';
import { dataFile } from './api/_lib.js';

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

function indexWords(posts) {
  return '<h1>' + esc(TITLE) + '</h1><p>' + esc(DESCRIPTION) + '</p>' +
    '<ol>' + posts.map(row).join('') + '</ol>' +
    '<p><a href="/">The map of Tallinn</a> · <a href="/lists">Lists</a></p>';
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
  if (!posts.length) return page(html, 200, true);

  const asked = new URL(request.url).searchParams.get('post');
  const post = asked && WRITTEN.test(asked) ? posts.find((p) => p.id === asked) || null : null;

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

  return page(fill(rehead(html, said), EMPTY[FILE.slice(1)], post ? postWords(post, posts) : indexWords(posts)), 200, true);
}
