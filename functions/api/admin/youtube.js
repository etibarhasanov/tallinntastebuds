/**
 * Tallinn Tastebuds — the studio's films on YouTube, for /azeri.
 *
 * GET /api/admin/youtube           the three Azərbaycanfilm playlists
 * GET /api/admin/youtube?check=1   which watch links on the films are dead
 *
 * The owner's, behind the same lock as everything under /api/admin/ —
 * functions/_middleware.js answers 403 to anybody else before this runs.
 *
 * WHY IT IS HERE. tools/azfilms.mjs collects the films for /azeri and runs
 * where a session runs it, which has no way to hold a YouTube key that the
 * owner could put there. The site already holds its keys in the Pages
 * dashboard, so the key goes there as YOUTUBE_API_KEY, Production only,
 * beside GOOGLE_MAPS_API_KEY, and this route spends it: the owner opens the
 * address signed in, saves what it answers, and the tool reads the saved
 * file with --from. Nothing on the site calls YouTube on its own, and no
 * visitor's page ever waits on this.
 *
 * WHAT IT ANSWERS. Without `check`:
 *
 *   { at, playlists: [ { id, lang, videos: [ { id, title } ] } ] }
 *
 * every video of the studio's three playlists, fifty to a call — about five
 * calls a playlist, a unit each of the ten thousand a day YouTube gives a
 * key. With `check=1`:
 *
 *   { at, asked, dead: [ id, … ] }
 *
 * the YouTube ids of every watch link and every "Maybe" link the films
 * carry, asked about fifty to a call, and the ones YouTube no longer has, or
 * has made private. About fourteen calls for some seven hundred links. The
 * two are separate addresses because a Function on the free plan may make
 * fifty requests, and the films' twenty-seven files are requests too.
 *
 * WHAT IT COSTS. No row of the database beyond the owner's own session, which
 * the middleware reads to let them in. `no-store`, since it is somebody's
 * key's quota and nobody else's to see.
 */

import { json, dataFile } from '../_lib.js';

const PLAYLISTS = [
  { id: 'PLAtI5OWgNzB3iuvjwhQzW60A1jQ8LdxBp', lang: 'az' }, // Tammetrajlı bədii filmlər
  { id: 'PLAtI5OWgNzB1wzuPM18PZ2eKSagWgFMAv', lang: 'az' }, // Klassik filmlər
  { id: 'PLAtI5OWgNzB2qF-wUqAn0spyq2C6HLVq0', lang: 'ru' }, // Фильмы на русском языке
];
const API = 'https://www.googleapis.com/youtube/v3/';
const INDEX = '/azeri/data/index.json';
const CHUNKS = '/azeri/data/films/';

/* The key as the Pages dashboard holds it, trimmed and held to the shape of
   a Google key, so a stray word in the box reads as absent — the same test
   googleKey() in ../_refresh.js puts the Places key to. */
function youtubeKey(env) {
  const key = String((env && env.YOUTUBE_API_KEY) || '').trim();
  return /^[A-Za-z0-9_-]{30,64}$/.test(key) ? key : '';
}

async function ask(path, key) {
  const res = await fetch(API + path, { headers: { 'X-Goog-Api-Key': key } });
  if (!res.ok) throw new Error('youtube ' + res.status);
  return res.json();
}

async function playlist(id, key) {
  const videos = [];
  let page = '';
  do {
    const out = await ask(`playlistItems?part=snippet&maxResults=50&playlistId=${id}` +
      (page ? `&pageToken=${page}` : ''), key);
    for (const item of out.items || []) {
      videos.push({ id: item.snippet.resourceId.videoId, title: item.snippet.title });
    }
    page = out.nextPageToken || '';
  } while (page);
  return videos;
}

const YOUTUBE_ID = /(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{11})/;

/* Every YouTube id a film links to, out of the files /api/azeri reads. */
async function linkedIds(context) {
  const index = await dataFile(context, INDEX);
  const ids = new Set();
  const files = Math.ceil(index.rows.length / index.chunk);
  for (let n = 0; n < files; n++) {
    for (const film of await dataFile(context, CHUNKS + n + '.json')) {
      for (const link of film.watch.concat(film.video)) {
        const m = YOUTUBE_ID.exec(link.url);
        if (m) ids.add(m[1]);
      }
    }
  }
  return [...ids];
}

/* An id YouTube answers nothing for is gone; one it answers as private is as
   good as gone to anybody pressing Watch. */
async function deadOf(ids, key) {
  const dead = [];
  for (let at = 0; at < ids.length; at += 50) {
    const batch = ids.slice(at, at + 50);
    const out = await ask(`videos?part=status&maxResults=50&id=${batch.join(',')}`, key);
    const alive = new Set((out.items || [])
      .filter((v) => v.status && v.status.privacyStatus !== 'private')
      .map((v) => v.id));
    for (const id of batch) if (!alive.has(id)) dead.push(id);
  }
  return dead;
}

export async function onRequestGet(context) {
  const key = youtubeKey(context.env);
  if (!key) return json({ error: 'no-key' }, 503);
  const at = new Date().toISOString();
  try {
    if (new URL(context.request.url).searchParams.get('check') === '1') {
      const ids = await linkedIds(context);
      return json({ at, asked: ids.length, dead: await deadOf(ids, key) });
    }
    const playlists = [];
    for (const list of PLAYLISTS) playlists.push({ ...list, videos: await playlist(list.id, key) });
    return json({ at, playlists });
  } catch (e) {
    return json({ error: 'youtube', message: String(e.message || e) }, 502);
  }
}
