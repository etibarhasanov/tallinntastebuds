/**
 * Tallinn Tastebuds — /privacy, what the site keeps about a visitor.
 *
 * privacy.html with the whole policy written into it, in one language, out
 * of data/privacy.json. It is a page somebody reads rather than uses, and
 * the one page on the site that has to be readable by anybody who asks —
 * a crawler, a reader with scripts off, somebody's lawyer — so the words are
 * written here on the server rather than drawn by a script, and nothing in
 * the browser draws over them. **Privacy** in README.md is the page's half.
 *
 * ONE LANGUAGE PER ADDRESS
 *
 * /privacy is the English, which is the version that counts; /privacy?lang=et
 * and the rest are the same policy in that language, each saying at the top
 * that it is a translation. assets/privacy.js sends a reader who arrives at
 * the bare address in another language to theirs, the way the map is read at
 * ?lang= — so the server writes exactly one language and the browser never
 * draws the text a second time. A ?lang= the file does not have is the
 * English.
 *
 * LINKS INSIDE IT
 *
 * A paragraph may carry [words](/path) or [words](https://…) — the blog's one
 * piece of markup, with the outside world allowed as well, because the
 * policy has to point at Instagram and at the regulator. They open where
 * they are, like every other link on this site.
 *
 * WHAT HAPPENS WHEN IT CANNOT
 *
 * The untouched page with its English head, through context.next(), where the
 * file or the policy cannot be read — a broken deploy rather than a state.
 */

import { canonical, esc, head, shell, rehead, fill, EMPTY, page } from './_shell.js';
import { dataFile } from './api/_lib.js';

const PATH = '/privacy';
const FILE = '/privacy.html';
const POLICY_FILE = '/data/privacy.json';
const DEFAULT_LANG = 'en';

/* A language for the dates, where a code alone draws the wrong one: "en" is
   en-US in every engine, and this site's English writes the day first. The
   blog's LOCALES says the same. */
const LOCALES = { en: 'en-GB' };

/* [words](/path) or [words](https://…). A path must start with one slash —
   "//host" is somebody else's site dressed as this one. */
const LINK = /\[([^\]]+)\]\(((?:\/(?!\/)|https:\/\/)[^)\s]*)\)/g;

function say(pack, lang) {
  return (pack && (pack[lang] || pack[DEFAULT_LANG])) || '';
}

/* A paragraph, escaped, with its links made links — pieced together rather
   than run through String.replace, for the reason sow() in ./_shell.js
   gives. */
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

function dated(day, lang) {
  try {
    return new Intl.DateTimeFormat(LOCALES[lang] || lang, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
      .format(new Date(day + 'T00:00:00Z'));
  } catch (e) {
    return day;
  }
}

/* The policy as the page shows it: the title, the line under it, when it
   last changed and — in any language but English — that it is a
   translation; then a card per section. The classes are the blog's and the
   lists page's, so a policy reads the way a post does. */
function words(policy, lang) {
  /* Two lines rather than one sentence: a date some languages close with a
     full stop of their own — "5 октября 2026 г." — cannot be followed by
     another, so the label carries none and the note about the translation
     starts a line of its own. */
  const note = esc(say(policy.updatedLabel, lang).replace('{date}', dated(policy.updated, lang))) +
    (lang === DEFAULT_LANG ? '' : '<br>' + esc(say(policy.translated, lang)));
  const sections = policy.sections.map((s) =>
    '<section class="card lists-card" id="' + esc(s.id) + '">' +
      '<h2 class="lists-title">' + esc(say(s.title, lang)) + '</h2>' +
      '<div class="blog-body">' +
        (s.body[lang] || s.body[DEFAULT_LANG]).map((p) => '<p>' + prose(p) + '</p>').join('') +
      '</div>' +
    '</section>');
  return '<div class="lists-stack">' +
    '<header class="blog-head">' +
      '<p class="eyebrow">Tallinn Tastebuds</p>' +
      '<h1 class="blog-title">' + esc(say(policy.title, lang)) + '</h1>' +
      '<p class="blog-lead">' + esc(say(policy.lead, lang)) + '</p>' +
      '<p class="blog-note">' + note + '</p>' +
    '</header>' +
    sections.join('') +
  '</div>';
}

export async function onRequest(context) {
  const { request } = context;

  let html;
  let policy;
  try {
    html = await shell(context, FILE);
    policy = await dataFile(context, POLICY_FILE);
  } catch (e) {
    return context.next();
  }
  if (!policy || !Array.isArray(policy.sections)) return context.next();

  const asked = new URL(request.url).searchParams.get('lang');
  const lang = asked && policy.title && policy.title[asked] ? asked : DEFAULT_LANG;
  const path = lang === DEFAULT_LANG ? PATH : PATH + '?lang=' + lang;

  const tags = head({
    title: say(policy.title, lang),
    description: say(policy.lead, lang),
    url: canonical(request, path),
    type: 'website'
  });

  const out = fill(rehead(html, tags), EMPTY[FILE.slice(1)], words(policy, lang))
    .replace('<html lang="en">', () => '<html lang="' + esc(lang) + '">');
  return page(out, 200, true);
}
