/**
 * Tallinn Tastebuds — /azeri, the Azerbaijani corner, with its home as text.
 *
 * azeri.html again, with a head of its own and, at the home, the home
 * written into the page: who the corner is for, what is in each tab, and the
 * questions people ask with their answers. The page draws all of that with a
 * script, out of /api/azeri, and until 2026-11-21 it did not matter that a
 * reader who runs no script got an empty column: the corner was linked from
 * nowhere and told every search engine to stay out. The owner asked for it
 * to be found that day, with its home, so the home is written here
 * for the readers that never run the script — Bing on many of its visits,
 * Yandex on most, every assistant that fetches a page to read it — and
 * named in sitemap.xml. **Home** under **The Azerbaijani corner** in
 * docs/handbook.md is the page's half.
 *
 * ONE LANGUAGE PER ADDRESS
 *
 * The corner is written in four languages, and each is an address: /azeri
 * is the Azerbaijani, the language the corner opens in, and /azeri?lang=en,
 * ?lang=ru and ?lang=et the others, each naming all four as alternates, the
 * way the map's addresses do. A ?lang= the corner is not written in is the
 * Azerbaijani. The script reads the same ?lang= first when it picks the
 * language to draw in, and Azerbaijani where there is none and the reader
 * has chosen nothing, so what a crawler that does run it sees at an address
 * is the language the address says.
 *
 * WHAT IS WRITTEN, AND WHERE
 *
 * At the home — no ?tab=, or ?tab=home — its sentence, the other tabs as
 * links, each with its line, and every question with its answer and the link
 * it ends in, inside #shelf and inside unscripted(), so a reader whose
 * browser runs scripts sees the column empty for the moment before
 * assets/azeri.js empties it and draws; and the questions again as an
 * FAQPage in JSON-LD. A link into the corner keeps the address's language.
 * At a tab — ?tab=films and the rest — only the head: what is under those is
 * a search over 2,615 films, a guide whose topics open one at a time, or a
 * map, and the script draws them as it always did. They are indexed as
 * themselves, the canonical naming the tab and the language and nothing
 * else of the address.
 *
 * WHAT IT COSTS
 *
 * Nothing in the database. The page out of the deployment, the home's file
 * and one language's words, the last two kept five minutes per isolate by
 * dataFile(). Answered no-store, as /privacy is: with two of the three
 * files already kept, a copy in the colo would save one fetch out of the
 * deployment, and is a key and a stamp to keep right for it.
 *
 * WHAT HAPPENS WHEN IT CANNOT
 *
 * The untouched page, through context.next(), where a file cannot be read —
 * a broken deploy rather than a state. The script draws the home all the
 * same, out of the route.
 */

import { canonical, esc, seed, head, shell, rehead, fill, unscripted, EMPTY, page } from './_shell.js';
import { dataFile } from './api/_lib.js';

const PATH = '/azeri';
const FILE = '/azeri.html';
const HOME_FILE = '/azeri/data/guide/home.json';
const LANG_FILE = '/data/lang/';
/* The language of the bare address — what pickLanguage() in
   assets/azeri.js falls back to, and CORNER_HOME in tools/sitemap.mjs. */
const DEFAULT_LANG = 'az';
/* The four the corner is written in — GUIDE_LANGS in functions/api/azeri.js
   and CORNER_LANGS in tools/sitemap.mjs. Change one, change the others. */
const LANGS = ['az', 'en', 'ru', 'et'];
/* Each tab's name, by the key azeri.html prints it under. The page reads a
   tab's name off the tab; here there is no tab to read it off. */
const TAB_KEYS = {
  films: 'azeriFilms',
  community: 'azeriCommunity',
  estonia: 'azeriEstonia',
  study: 'azeriStudy',
  estonian: 'azeriEstonian',
  food: 'azeriPlaces'
};

/* An address of the corner in a language: the tab, where it is not the
   home, and the language, where it is not Azerbaijani — the order the page
   writes them in, so a crawler meets one spelling of each. */
function cornerAt(tab, lang) {
  const query = new URLSearchParams();
  if (tab && tab !== 'home') query.set('tab', tab);
  if (lang !== DEFAULT_LANG) query.set('lang', lang);
  const said = query.toString();
  return PATH + (said ? '?' + said : '');
}

/* A link an answer ends in, in the address's language where it leads into
   the corner, and as it is where it leads anywhere else on the site. */
function linkIn(url, lang) {
  if (lang === DEFAULT_LANG || !url.startsWith(PATH + '?')) return url;
  return url + '&lang=' + lang;
}

/* A string of the file's in one language; the English, as the route's
   say() falls back to, is a fallback the validator keeps anything from
   reaching. */
function say(text, lang) {
  return typeof text === 'string' ? text : (text && (text[lang] || text.en)) || '';
}

/* An answer as text: its paragraphs, the only kind of block a question of
   the home is written in. */
function answerOf(topic, lang) {
  return topic.body.filter((b) => b.p).map((b) => say(b.p, lang)).join(' ');
}

/* The home as the page shows it, in the classes it is drawn with: the
   tabs, the questions, and the line saying whose word is final. Its
   sentence, `say`, is the description in the head and nowhere in the
   page, since the owner took it off the page on 2026-11-21. */
function words(home, ui, lang) {
  const sections = home.sections.map((s) => {
    const [before, after] = say(s.line, lang).split('{tab}');
    return '<li>' + esc(before) + '<a href="' + esc(cornerAt(s.tab, lang)) + '">' + esc(ui[TAB_KEYS[s.tab]] || s.tab) + '</a>' +
      esc(after) + '</li>';
  });
  const questions = home.topics.map((topic) =>
    '<h3>' + esc(say(topic.name, lang)) + '</h3>' +
    '<p>' + esc(answerOf(topic, lang)) + '</p>' +
    topic.links.map((l) => '<p><a href="' + esc(linkIn(l.url, lang)) + '">' + esc(say(l.name, lang)) + '</a></p>').join(''));
  return unscripted(
    '<h2>' + esc(ui.azeriStart) + '</h2>' +
    '<ul>' + sections.join('') + '</ul>' +
    '<h2>' + esc(ui.azeriQuestions) + '</h2>' +
    questions.join('') +
    '<p class="azeri-credit">' + esc(ui.azeriGuideCredit) + '</p>');
}

function questionsAsData(request, home, title, lang) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    url: canonical(request, cornerAt('home', lang)),
    name: title,
    inLanguage: lang,
    mainEntity: home.topics.map((topic) => ({
      '@type': 'Question',
      name: say(topic.name, lang),
      acceptedAnswer: { '@type': 'Answer', text: answerOf(topic, lang) }
    }))
  };
}

export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  const asked = url.searchParams.get('lang');
  const lang = LANGS.includes(asked) ? asked : DEFAULT_LANG;
  const tabAsked = url.searchParams.get('tab');
  const tab = TAB_KEYS[tabAsked] ? tabAsked : 'home';

  let html;
  let home;
  let ui;
  try {
    html = await shell(context, FILE);
    home = await dataFile(context, HOME_FILE);
    ui = (await dataFile(context, LANG_FILE + lang + '.json')).ui;
  } catch (e) {
    return context.next();
  }
  if (!home || !Array.isArray(home.topics) || !Array.isArray(home.sections) || !ui) return context.next();

  const title = ui.azeriTitle;
  /* Every language's address of this tab, the Azerbaijani twice — once as
     itself and once as where a reader of none of the four lands. */
  const alternates = [['x-default', DEFAULT_LANG]].concat(LANGS.slice().sort().map((code) => [code, code]))
    .map(([hreflang, code]) =>
      '<link rel="alternate" hreflang="' + hreflang + '" href="' + esc(canonical(request, cornerAt(tab, code))) + '">');
  let tags = head({
    title,
    description: say(home.say, lang),
    url: canonical(request, cornerAt(tab, lang)),
    type: 'website'
  }) + '\n' + alternates.join('\n');

  let out = html;
  if (tab === 'home') {
    tags += '\n<script type="application/ld+json">' + seed(questionsAsData(request, home, title, lang)) + '</script>';
    out = fill(out, EMPTY[FILE.slice(1)], words(home, ui, lang));
  }
  out = rehead(out, tags).replace('<html lang="en">', () => '<html lang="' + esc(lang) + '">');
  return page(out, 200, true);
}
