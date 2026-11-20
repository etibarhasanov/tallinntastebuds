#!/usr/bin/env node
/**
 * Tallinn Tastebuds — the Azerbaijani films, collected.
 *
 * /azeri is a corner of the site about Azerbaijan, for signed-in members
 * only, in Azerbaijani and English, and its first shelf is the country's
 * cinema. This is where that shelf's rows come from: the Azerbaijani
 * Wikipedia's "Azərbaycan filmlərinin siyahısı", 2,615 films from 1898 to
 * now — feature films, documentaries, cartoons, serials, filmed plays — in
 * alphabetical order, one line each.
 *
 *   az.wikipedia.org                  the list, and the article behind each
 *                                     linked title. Read with action=raw,
 *                                     one plain request per page: the API's
 *                                     batched revision query answers a
 *                                     shared egress address with "too many
 *                                     requests", and action=raw does not.
 *
 *   azeri/data/films.json             GENERATED — by this file. Under
 *                                     /azeri rather than /data on purpose:
 *                                     _routes.json sends /data/* straight to
 *                                     the static files, past every Function,
 *                                     so anything there is public to anyone
 *                                     with its address. /azeri/* goes through
 *                                     the Functions, which is where the
 *                                     members-only check can stand.
 *
 *   node tools/azfilms.mjs                 the list alone: one request
 *   node tools/azfilms.mjs --articles      and every linked article, one a
 *                                          second (about forty minutes the
 *                                          first time), cached so a second
 *                                          run asks again only for what is
 *                                          missing
 *   node tools/azfilms.mjs --cache <dir>   where that cache lives; the
 *                                          default is under the system's
 *                                          temporary directory
 *
 * Zero dependencies, like every tool here. It is not in tools/generate.mjs
 * and CI never runs it: its source is a website, not a file in the repo, so
 * it is run by hand when the shelf wants refreshing and the result committed.
 *
 * WHAT A ROW IS
 *
 * One line of the list, which reads, at its fullest:
 *
 *   # [[Babək (film, 1979)]] (tammetrajlı bədii film) ([https://… Filmi izlə])
 *
 * — the title, the year or span in brackets, the kind in Azerbaijani, and
 * sometimes a link to watch it. The row keeps every one of those as written
 * (`title`, `kindAz`) beside what a page can filter on (`year`, `kind`,
 * `length`), because the Azerbaijani words are the ones the page shows in
 * Azerbaijani and the normalised ones are what it shows in English.
 *
 * `watch` is the list's own links, labelled the way the list labels them —
 * the film, a trailer, a fragment, one part of a serial. Only about a
 * hundred and sixty lines have one. `video` is what the article adds, with
 * --articles: YouTube links found anywhere in it. Those are kept apart from
 * `watch` because an article links a premiere, an interview or a dubbing as
 * readily as the film itself, so a `video` link is a lead to check and never
 * a promise that the film is behind it.
 *
 * From the article's {{Film}} box come `director`, `writer`, `cast`, `imdb`
 * and `image` (a file name on Wikimedia Commons or the Azerbaijani wiki), and
 * from its first paragraph, `about` — the sentence or two the wiki opens on,
 * in Azerbaijani, with the markup taken out.
 *
 * The text is CC BY-SA, and every row keeps `wiki` — the article's title, or
 * null for the four hundred lines with no article — so the page can credit
 * and link it.
 */

import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'azeri', 'data', 'films.json');
const WIKI = 'https://az.wikipedia.org';
const LIST = 'Azərbaycan filmlərinin siyahısı';
/* Wikimedia asks automated clients to say who they are. The site's address
   is enough to say it; nobody's name or mail goes in it. */
const AGENT = 'TallinnTastebudsFilmList/1.0 (https://tallinntastebuds.ee)';
const PAUSE = 1000;

const args = process.argv.slice(2);
const ARTICLES = args.includes('--articles');
const YOUTUBE = args.includes('--youtube');
const cacheAt = args.indexOf('--cache');
const CACHE = cacheAt >= 0 ? args[cacheAt + 1] : join(tmpdir(), 'ttb-azfilms');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function raw(title) {
  const url = `${WIKI}/w/index.php?action=raw&title=${encodeURIComponent(title)}`;
  for (let wait = 5000; ; wait *= 2) {
    const res = await fetch(url, { headers: { 'User-Agent': AGENT } });
    if (res.status === 404) return null;
    if (res.ok) return res.text();
    if (wait > 160000) throw new Error(`${res.status} for ${title}`);
    console.warn(`  ${res.status} for ${title}, waiting ${wait / 1000}s`);
    await sleep(wait);
  }
}

/* One request per article, a second apart, and every answer kept on disk —
   a missing article as an empty file — so a run that stops halfway is
   picked up where it stopped. */
async function cached(title) {
  mkdirSync(CACHE, { recursive: true });
  const file = join(CACHE, createHash('sha1').update(title).digest('hex') + '.wiki');
  if (existsSync(file)) return readFileSync(file, 'utf8') || null;
  await sleep(PAUSE);
  const text = await raw(title);
  writeFileSync(file, text || '');
  return text;
}

const REDIRECT = /^#(?:REDIRECT|İSTİQAMƏTLƏNDİRMƏ|YÖNLƏNDİRMƏ)\s*\[\[([^\]|#]+)/i;

async function article(title) {
  let text = await cached(title);
  for (let hops = 0; text && hops < 3; hops++) {
    const m = text.match(REDIRECT);
    if (!m) break;
    title = m[1].trim();
    text = await cached(title);
  }
  return text ? { title, text } : null;
}

/* ---------- the list ---------- */

const KINDS = [
  // Order matters: the first match wins, so the mixed forms come first.
  [/cizgi/, 'animation'],
  [/serial|seriyalı/, 'series'],
  [/tamaşa/, 'play'],
  [/kinoalmanax/, 'anthology'],
  [/süjet/, 'newsreel'],
  [/konsert/i, 'concert'],
  [/musiqili/, 'musical'],
  [/sənədli-bədii|bədii-sənədli/, 'docudrama'],
  [/bədii/, 'feature'],
  [/sənədli/, 'documentary'],
];

function kindOf(az) {
  for (const [re, kind] of KINDS) if (re.test(az)) return kind;
  return 'other';
}

function lengthOf(az) {
  if (/qısametrajlı/.test(az)) return 'short';
  if (/tammetrajlı/.test(az)) return 'full';
  return null;
}

const WATCH = [
  [/^Treyleri/, 'trailer'],
  [/^Fraqmenti/, 'fragment'],
  [/^Filmi/, 'film'],
];

function slug(s) {
  return s
    .toLowerCase()
    .replace(/ə/g, 'e').replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ü/g, 'u')
    .replace(/ş/g, 's').replace(/ç/g, 'c').replace(/ğ/g, 'g')
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'film';
}

function parseLine(line) {
  let rest = line.replace(/^#\s*/, '').trim();
  const watch = [];
  rest = rest.replace(/\[(https?:\/\/\S+)\s+([^\]]+)\]/g, (_, url, label) => {
    const kind = (WATCH.find(([re]) => re.test(label)) || [null, 'film'])[1];
    const part = (label.match(/\(([^)]+)\)\s*$/) || [])[1] || null;
    watch.push({ url, kind, part, label });
    return '';
  });
  rest = rest.replace(/\(\s*(?:,\s*)*\)/g, '').replace(/\s+/g, ' ').trim();

  let wiki = null;
  let name;
  const link = rest.match(/^\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/);
  if (link) {
    wiki = link[1].trim();
    name = (link[2] || link[1]).trim();
    rest = rest.slice(link[0].length).trim();
  } else {
    // An unlinked title runs up to its kind: the last bracket that is not
    // "(film, …)" and not a note like "(AzTV)".
    const m = rest.match(/^(.*?\(film[^)]*\)(?:\s*\((?:I|II)\))?)\s*(.*)$/);
    if (m) { name = m[1].trim(); rest = m[2]; }
    else {
      const k = rest.match(/^(.*?)\s*(\([^()]*(?:film|serial|tamaşa|kinoalmanax|süjet)[^()]*\).*)$/);
      name = k ? k[1].trim() : rest;
      rest = k ? k[2] : '';
    }
  }

  const notes = [...rest.matchAll(/\(([^()]*(?:\([^()]*\))?[^()]*)\)/g)].map((m) => m[1].trim());
  const kindAz = notes.find((n) => n !== 'AzTV') || '';
  const source = notes.includes('AzTV') ? 'AzTV' : null;

  // "Babək (film, 1979)" → "Babək", 1979; "Ailəm (film, 2006)" → years.
  const paren = name.match(/^(.*?)\s*\(film(?:,\s*([^)]*))?\)\s*(\((?:I|II)\))?$/);
  const title = paren ? paren[1].trim() + (paren[3] ? ' ' + paren[3] : '') : name;
  const span = paren && paren[2] ? paren[2] : '';
  const years = (span.match(/\d{4}/g) || []).map(Number);

  return {
    title,
    year: years[0] || null,
    yearTo: years.length > 1 ? years[years.length - 1] : null,
    kind: kindOf(kindAz),
    length: lengthOf(kindAz),
    kindAz,
    wiki,
    source,
    watch,
  };
}

/* ---------- an article ---------- */

function box(text, field) {
  const m = text.match(new RegExp(`\\n\\s*\\|\\s*${field}\\s*=([^\\n]*)`));
  return m ? m[1].trim() : '';
}

function names(value) {
  return value
    .split(/<br\s*\/?>|,|\n/i)
    .map((s) => plain(s))
    .filter((s) => s && s.length < 80);
}

function plain(s) {
  return s
    .replace(/<ref[^>]*\/>/g, '')
    .replace(/<ref[^>]*>[\s\S]*?<\/ref>/g, '')
    .replace(/\{\{[^{}]*\}\}/g, '')
    .replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, '$1')
    .replace(/\[https?:\/\/\S+\s*([^\]]*)\]/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/'''?/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function lead(text) {
  let body = text;
  // Strip whole templates, nested ones included, before the first heading.
  for (let i = 0; i < 6; i++) body = body.replace(/\{\{[^{}]*\}\}/g, '');
  body = body.split(/\n==/)[0];
  const para = body
    .split(/\n\s*\n/)
    .map((p) => plain(p.replace(/\[\[(?:Şəkil|Fayl|File|Image):[^\]]*\]\]/gi, '')))
    .find((p) => p.length > 20);
  if (!para) return null;
  return para.length > 600 ? para.slice(0, para.lastIndexOf('. ', 600) + 1 || 600) : para;
}

function videos(text) {
  const out = [];
  const seen = new Set();
  for (const m of text.matchAll(/https?:\/\/(?:www\.|m\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{11})[^\s|\]}]*(?:\s+([^\]\n]*))?/g)) {
    if (seen.has(m[1])) continue;
    seen.add(m[1]);
    out.push({ url: `https://www.youtube.com/watch?v=${m[1]}`, label: m[2] ? plain(m[2]).slice(0, 120) || null : null });
  }
  return out;
}

function details(text) {
  const imdb = (box(text, 'imdb_id').match(/\d+/) || text.match(/\{\{IMDb title\s*\|\s*(?:id=)?(?:tt)?(\d+)/i) || [])[0];
  const imdbId = imdb ? 'tt' + imdb.replace(/\D/g, '').padStart(7, '0') : null;
  const image = plain(box(text, 'şəkil')) || null;
  return {
    director: names(box(text, 'rejissor')),
    writer: names(box(text, 'ssenarist')),
    cast: names(box(text, 'rollarda')).slice(0, 12),
    imdb: imdbId,
    image: image && /\.(jpe?g|png|gif|webp)$/i.test(image) ? image : null,
    about: lead(text),
    video: videos(text),
  };
}

/* ---------- the studio's playlists ---------- */

/* Azərbaycanfilm's own channel keeps its films in playlists, which is where
   most of them can actually be watched — the list links a hundred and sixty.
   A playlist page carries its first hundred videos in ytInitialData and a
   token for the next hundred, which YouTube's own page asks its browse
   endpoint for; this asks it the same way. No key of ours is involved: the
   key in the request is the one the page itself ships to every browser. */
const PLAYLISTS = [
  { id: 'PLAtI5OWgNzB3iuvjwhQzW60A1jQ8LdxBp', lang: 'az' }, // Tammetrajlı bədii filmlər
  { id: 'PLAtI5OWgNzB1wzuPM18PZ2eKSagWgFMAv', lang: 'az' }, // Klassik filmlər
  { id: 'PLAtI5OWgNzB2qF-wUqAn0spyq2C6HLVq0', lang: 'ru' }, // Фильмы на русском языке
];
const YT = 'https://www.youtube.com';
const BROWSER = { 'User-Agent': 'Mozilla/5.0', 'Accept-Language': 'az,en;q=0.8' };

function lockups(node, out = []) {
  if (!node || typeof node !== 'object') return out;
  if (node.lockupViewModel && node.lockupViewModel.contentType === 'LOCKUP_CONTENT_TYPE_VIDEO') {
    const v = node.lockupViewModel;
    const time = (JSON.stringify(v.contentImage).match(/"text":"(\d+(?::\d\d){1,2})"/) || [])[1] || null;
    out.push({ id: v.contentId, title: v.metadata.lockupMetadataViewModel.title.content, time });
    return out;
  }
  if (node.continuationCommand && node.continuationCommand.token) out.token = node.continuationCommand.token;
  for (const v of Object.values(node)) lockups(v, out);
  return out;
}

async function playlist(id) {
  const page = await (await fetch(`${YT}/playlist?list=${id}`, { headers: BROWSER })).text();
  const data = JSON.parse(page.match(/var ytInitialData = (\{.*?\});<\/script>/s)[1]);
  const key = page.match(/"INNERTUBE_API_KEY":"([^"]+)"/)[1];
  const clientVersion = page.match(/"INNERTUBE_CLIENT_VERSION":"([^"]+)"/)[1];
  const videos = [];
  let found = lockups(data);
  for (;;) {
    videos.push(...found);
    if (!found.token) break;
    await sleep(PAUSE);
    const res = await fetch(`${YT}/youtubei/v1/browse?key=${key}`, {
      method: 'POST',
      headers: { ...BROWSER, 'Content-Type': 'application/json' },
      body: JSON.stringify({ context: { client: { clientName: 'WEB', clientVersion, hl: 'az' } }, continuation: found.token }),
    });
    found = lockups(await res.json());
  }
  return videos;
}

/* "Bizim Cəbiş müəllim (1969) | Our Teacher Jabish" → the Azerbaijani title,
   the year and the English one; a Russian title stands alone. */
function videoTitle(t) {
  const [main, en] = t.split(/\s+\|\s+/);
  const m = main.match(/^(.*?)\s*\((\d{4})\)\s*(.*)$/);
  return {
    name: (m ? m[1] + (m[3] ? ' ' + m[3] : '') : main).replace(/["«»“”]/g, '').trim(),
    year: m ? Number(m[2]) : null,
    en: en ? en.trim() : null,
  };
}

const key = (s) => slug(s.replace(/\(.*?\)/g, ''));

/* A video belongs to a film when their titles agree once the letters are
   folded and the punctuation is gone, and their years are within one — a
   release a year after shooting is common enough to allow, and the same
   title in another decade is common enough to refuse. */
function match(films, video) {
  const t = videoTitle(video.title);
  const k = key(t.name);
  const near = films.filter((f) => key(f.title) === k);
  if (!near.length) return { t, film: null };
  if (t.year) {
    const by = near.filter((f) => f.year && Math.abs(f.year - t.year) <= 1);
    return { t, film: by.length === 1 ? by[0] : null };
  }
  return { t, film: near.length === 1 ? near[0] : null };
}

/* ---------- the run ---------- */

const listText = await raw(LIST);
if (!listText) throw new Error(`no page called ${LIST}`);
const lines = listText.split('\n').filter((l) => /^#\s*\S/.test(l) && !REDIRECT.test(l));
const films = lines.map(parseLine);

// Ids: the slug of the title and year, numbered on the rare clash.
const used = new Map();
for (const f of films) {
  const base = slug(`${f.title}${f.year ? '-' + f.year : ''}`);
  const n = (used.get(base) || 0) + 1;
  used.set(base, n);
  f.id = n === 1 ? base : `${base}-${n}`;
}

if (ARTICLES) {
  const linked = films.filter((f) => f.wiki);
  console.log(`${linked.length} articles to read, cached in ${CACHE}`);
  let i = 0;
  for (const f of linked) {
    if (++i % 100 === 0) console.log(`  ${i} / ${linked.length}`);
    const a = await article(f.wiki);
    if (!a) { f.wiki = null; continue; }
    f.wiki = a.title;
    Object.assign(f, details(a.text));
  }
}

const unmatched = [];
if (YOUTUBE) {
  for (const list of PLAYLISTS) {
    const videos = await playlist(list.id);
    console.log(`${videos.length} videos in playlist ${list.id}`);
    for (const v of videos) {
      const { t, film } = match(films, v);
      const url = `https://www.youtube.com/watch?v=${v.id}`;
      if (!film) { unmatched.push({ url, title: v.title, lang: list.lang, time: v.time }); continue; }
      if (film.watch.some((w) => w.url === url)) continue;
      film.watch.push({ url, kind: 'film', part: null, lang: list.lang, time: v.time, studio: true });
      if (t.en && !film.titleEn) film.titleEn = t.en;
    }
  }
}

const ordered = films.map((f) => ({
  id: f.id,
  title: f.title,
  titleEn: f.titleEn || null,
  year: f.year,
  yearTo: f.yearTo,
  kind: f.kind,
  length: f.length,
  kindAz: f.kindAz,
  director: f.director || [],
  writer: f.writer || [],
  cast: f.cast || [],
  about: f.about || null,
  watch: f.watch.map(({ url, kind, part, lang, time, studio }) => ({ url, kind, part, lang: lang || null, time: time || null, studio: !!studio })),
  video: f.video || [],
  imdb: f.imdb || null,
  image: f.image || null,
  wiki: f.wiki,
  source: f.source,
}));

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify({
  source: `${WIKI}/wiki/${encodeURIComponent(LIST.replace(/ /g, '_'))}`,
  license: 'CC BY-SA 4.0',
  collected: new Date().toISOString().slice(0, 10),
  articles: ARTICLES,
  playlists: YOUTUBE ? PLAYLISTS.map((p) => p.id) : [],
  films: ordered,
  unmatched,
}, null, 1) + '\n');

const count = (k) => ordered.filter(k).length;
console.log(`${ordered.length} films → ${OUT.slice(ROOT.length + 1)}`);
console.log(`  ${count((f) => f.watch.length)} with a link to watch on the list`);
if (YOUTUBE) {
  console.log(`  ${count((f) => f.watch.some((w) => w.studio))} matched to a video of the studio's, ${unmatched.length} videos matched to nothing`);
}
if (ARTICLES) {
  console.log(`  ${count((f) => f.video.length)} with a YouTube link in the article`);
  console.log(`  ${count((f) => f.director.length)} with a director, ${count((f) => f.about)} with a summary`);
}
