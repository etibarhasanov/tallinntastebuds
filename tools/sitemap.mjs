#!/usr/bin/env node
/**
 * Tallinn Tastebuds — the sitemap.
 *
 * Reads the languages out of data/ui.json, the places out of
 * data/restaurants.json, the decks out of data/decks.json, the thirteen chip
 * lists out of tools/typelists.mjs and Google's five out of
 * tools/googlelists.mjs, and writes sitemap.xml: the map at each of its ten
 * addresses, every open place at its own, the directory, the blog, the
 * flashcards and every deck of them, and the eighteen lists.
 *
 *   node tools/sitemap.mjs           rewrite sitemap.xml
 *   node tools/sitemap.mjs --check   report that it is out of date, exit 1
 *
 * tools/validate.mjs runs the check, so a language added to ui.json, a place
 * added to the map or a chip added to it cannot ship without its address
 * here.
 *
 * WHY IT IS GENERATED
 *
 * It was three addresses written by hand, and that was the right size for a
 * hand. What made it a file to generate is the map: functions/index.js
 * serves it in whichever of the ten languages the address names, and a
 * search engine only treats ten addresses as one page in ten languages when
 * each of them links to all ten — so the map is ten entries of eleven lines
 * each, adding a language would mean touching every one of them, and every
 * place is another entry of the same shape that moves when the map does.
 *
 * WHAT IS IN IT, AND WHAT IS NOT
 *
 * The map, ten times, is the point of the file. The bare address is English
 * and is also the x-default — where somebody whose language is none of the
 * ten lands — and every other language is ?lang= on the same page, which is
 * the address assets/app.js writes into the address bar when somebody picks
 * that language, so nothing here is invented.
 *
 * Every open place, once: ?spot= on the bare page, carrying the same nine
 * alternates. functions/index.js serves that address with the place's own
 * head and the page's text led by the place — see A PLACE IS AN ADDRESS TOO
 * in its header — which is what makes it a page rather than a deep link.
 * Listed in English only, with the other nine named as alternates on each,
 * because listing all ten of every place would be a file ten times this
 * size saying nothing the alternates do not: a crawler that reads the
 * English entry is told where the Russian page is, and the Russian page
 * tells it again. A closed place is not a page and is not here. ?type=,
 * ?style= and ?list= are deep links into the page rather than pages of
 * their own, and the canonical tag on every one of them says so.
 *
 * /lists is here because it is the only page that links the lists together.
 * Every public list is indexable, but each was an island a crawler could
 * reach only if somebody had posted the link somewhere; this page is the way
 * in to all of them. People's own lists are still not listed one by one —
 * there are as many as people have made, they change as people write, and
 * the directory is where a crawler finds them. It was /lists/public until it
 * was not, and /lists/kept before that; both still answer, as 301s, and
 * neither is here, since a sitemap is for the address a page is at.
 *
 * /flashcard and the decks under it are here for the reason /blog is:
 * nothing on this site links to them except one row on /account.html, behind
 * a sign-in, so this file is very nearly the only way a crawler arrives. What
 * is at those addresses is Estonian — functions/flashcard.js writes each
 * deck's words into the page as text — and somebody searching for what one of
 * them means should find it. The decks people write for themselves are not
 * here and could not be: they need their owner's session to read at all.
 *
 * The eighteen lists the site itself wrote are the exception to that, and
 * are listed by name: the thirteen chip lists, one per filter on the map,
 * and Google's five top tens, all generated on ids that never move, and all
 * pages that answer the questions people actually type — the pubs and beer
 * bars in Tallinn, the bakeries, the top ten restaurants by Google's own
 * rating. They are as fixed as the map itself, and there is no reason for a
 * crawler to wait to meet them through the directory.
 *
 * /blog is the one entry doing the whole job on its own: nothing on this
 * site links to the blog, on purpose, so this file is how a crawler learns the
 * address exists at all. It is still a page written to be found — a post per
 * thing this site does, in prose — which is why it is indexed at all, and
 * robots.txt says so where the Disallow lines are. Only the index is listed;
 * the posts are ?post=<id> on it and the index links every one of them.
 *
 * NO DATES, NO FREQUENCIES, NO PRIORITIES
 *
 * The file used to carry a <lastmod>, a <changefreq> and a <priority> on
 * each entry, and it carries none now. Google says outright that it ignores
 * the last two, and that it trusts a <lastmod> only when it is consistently
 * right — and nothing in this repository knows when a page last changed. The
 * map changes with every blurb edited and every place closed, a list every
 * time somebody keeps it, and the date a hand wrote in was the day somebody
 * last remembered. A date that is wrong is worse than no date, because it
 * teaches a crawler to ignore the file.
 *
 * Zero dependencies, like every tool here: this has to still run in five
 * years with no `npm install`.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

import { LISTS as CHIP_LISTS } from './typelists.mjs';
import { LISTS as GOOGLE_LISTS } from './googlelists.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'sitemap.xml');
const UI = join(ROOT, 'data', 'ui.json');
const PLACES = join(ROOT, 'data', 'restaurants.json');
const DECKS = join(ROOT, 'data', 'decks.json');

/* The host, spelled out. robots.txt, the pages' own og: tags,
   tools/indexnow.mjs and functions/_shell.js each name it too — README.md
   under **Getting found** is the list to walk when it changes. */
const SITE = 'https://tallinntastebuds.ee';

/* The language the map is served in with no ?lang= on the address, which is
   the language index.html is written in. The same constant is DEFAULT_LANG
   in assets/app.js and in functions/index.js. */
const DEFAULT_LANG = 'en';

/* The one thing an address here could carry that XML would read as markup,
   and ?spot=…&lang=… carries it. */
const x = (text) => String(text).replace(/&/g, '&amp;');

/* An address on the map, in a language, standing on a place or not: the
   same rule addressOf() in functions/index.js applies, in the same order. */
function mapAt(lang, spot) {
  const url = new URL(SITE + '/');
  if (spot) url.searchParams.set('spot', spot);
  if (lang !== DEFAULT_LANG) url.searchParams.set('lang', lang);
  return url.toString();
}

function entry(loc, alternates) {
  const lines = ['  <url>', '    <loc>' + x(loc) + '</loc>'];
  for (const alt of alternates || []) {
    lines.push('    <xhtml:link rel="alternate" hreflang="' + alt.lang + '" href="' + x(alt.href) + '"/>');
  }
  lines.push('  </url>');
  return lines.join('\n');
}

export function render(langs, placeIds, deckIds) {
  /* Sorted by code, the way the switcher lists them and functions/index.js
     writes them into the head. */
  const codes = langs.slice().sort();
  /* Every language's address, on every language's entry, itself included —
     a search engine only trusts the set when each page returns it whole. */
  const alternates = (spot) => [{ lang: 'x-default', href: mapAt(DEFAULT_LANG, spot) }]
    .concat(codes.map((code) => ({ lang: code, href: mapAt(code, spot) })));

  const entries = [];
  for (const code of codes) entries.push(entry(mapAt(code), alternates()));
  entries.push(entry(SITE + '/lists'));
  entries.push(entry(SITE + '/blog'));
  /* The flashcards. A rail pill on the map links to /flashcard now, so that
     one address is found the way any linked page is; this file is still very
     nearly the only way in for a crawler to a particular deck, since neither
     the rail nor the row behind a sign-in on /account.html names one. One
     address for the decks and one per deck, which is where the Estonian
     actually is. No alternates: the cards are English and Estonian and there
     is no tenth translation of them to point at. */
  entries.push(entry(SITE + '/flashcard'));
  for (const id of deckIds) entries.push(entry(SITE + '/flashcard?d=' + id));
  for (const list of CHIP_LISTS) entries.push(entry(SITE + '/list/' + list.id));
  for (const list of GOOGLE_LISTS) entries.push(entry(SITE + '/list/' + list.id));
  for (const id of placeIds) entries.push(entry(mapAt(DEFAULT_LANG, id), alternates(id)));

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<!-- GENERATED by tools/sitemap.mjs from data/ui.json, data/restaurants.json,',
    '     tools/typelists.mjs and tools/googlelists.mjs. Do not edit by hand: the',
    '     header of that tool says what is here, what is deliberately not, and',
    '     why nothing carries a date. -->',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"',
    '        xmlns:xhtml="http://www.w3.org/1999/xhtml">',
    ...entries,
    '</urlset>',
    ''
  ].join('\n');
}

function languages() {
  return Object.keys(JSON.parse(readFileSync(UI, 'utf8')));
}

/* Every deck the site ships, by id, in the order of the file — which is the
   order they are drawn in. The decks people write for themselves are not here
   and never will be: they need their owner's session to read at all. */
function deckIds() {
  if (!existsSync(DECKS)) return [];
  const file = JSON.parse(readFileSync(DECKS, 'utf8'));
  return (Array.isArray(file.decks) ? file.decks : []).map((deck) => deck.id);
}

/* Every open place, by id, in the order of the file — which is the order a
   place was added in and never moves, so the file only changes when the map
   does. */
function placeIds() {
  return JSON.parse(readFileSync(PLACES, 'utf8'))
    .filter((place) => !place.closed)
    .map((place) => place.id);
}

export function stale() {
  try {
    const want = render(languages(), placeIds(), deckIds());
    const got = existsSync(OUT) ? readFileSync(OUT, 'utf8') : '';
    return want !== got;
  } catch (e) {
    return true;
  }
}

function main() {
  const check = process.argv.includes('--check');
  const langs = languages();
  const ids = placeIds();
  const decks = deckIds();
  const next = render(langs, ids, decks);
  const now = existsSync(OUT) ? readFileSync(OUT, 'utf8') : '';
  const count = langs.length + 3 + CHIP_LISTS.length + GOOGLE_LISTS.length + ids.length + decks.length;

  if (check) {
    if (now === next) {
      console.log(`${OUT} is up to date — ${count} addresses.`);
      return;
    }
    console.error(`${OUT} is out of date. Run: node tools/sitemap.mjs`);
    process.exit(1);
  }

  writeFileSync(OUT, next);
  console.log(
    `${OUT} — ${count} addresses: the map in ${langs.length} languages, ${ids.length} places, ` +
    `/lists, /blog, /flashcard and ${decks.length} decks, ${CHIP_LISTS.length} chip lists and ` +
    `${GOOGLE_LISTS.length} Google lists.`
  );
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
