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
 * where a session runs it. A session can read a playlist's own page, which
 * shows its first hundred videos and a rounded count of views beside each,
 * and that is where azeri/data/youtube.json first came from; past the
 * hundredth it would have to call YouTube's own endpoints, which are not
 * ours to call, or hold a key, which it has nowhere to keep. The site keeps
 * its keys in the Pages dashboard, so the key is YOUTUBE_API_KEY there,
 * Production only, beside GOOGLE_MAPS_API_KEY, and this route spends it: the
 * owner opens the address signed in and saves what it answers beside the
 * films, and the tool reads the files on its next run. Nothing on the site
 * calls YouTube on its own, and no visitor's page ever waits on this.
 *
 * WHAT IT ANSWERS. Without `check`, the file azeri/data/youtube.json:
 *
 *   { at, playlists: [ { id, lang, kind, videos: [ { id, title } ] } ] }
 *
 * every video of nine of the studio's playlists, fifty to a call — about
 * thirty calls, a unit each of the ten thousand a day YouTube gives a key.
 * With `check=1`, the file azeri/data/youtube-check.json:
 *
 *   { at, asked, dead: [ id, … ], views: { id: n, … } }
 *
 * every YouTube id the films link to, out of `linked` in the films' index,
 * asked about fifty to a call: the ones YouTube no longer has or has made
 * private, and how often each of the rest has been watched, which is what
 * the shelf is ordered by. About twenty-two calls for eleven hundred links.
 * Two addresses because a Function on the free plan may make fifty requests
 * and the two together would pass it; and the check reads the index alone,
 * not the films' twenty-seven files, for the same reason.
 *
 * WHAT IT COSTS. No row of the database beyond the owner's own session, which
 * the middleware reads to let them in. `no-store`, since it is somebody's
 * key's quota and nobody else's to see.
 */

import { json, dataFile } from '../_lib.js';

/* The playlists a film can be watched from, and what each is: the language
   its videos are in and whether they are films or trailers. The rest of the
   channel — talks, music, behind the camera — is not the films. */
const PLAYLISTS = [
  { id: 'PLAtI5OWgNzB3iuvjwhQzW60A1jQ8LdxBp', lang: 'az', kind: 'film' },    // Tammetrajlı bədii filmlər
  { id: 'PLAtI5OWgNzB1wzuPM18PZ2eKSagWgFMAv', lang: 'az', kind: 'film' },    // Klassik filmlər
  { id: 'PLAtI5OWgNzB2yNSbw37qGVVI8imrRaVlI', lang: 'az', kind: 'film' },    // Qısametrajlı filmlər
  { id: 'PLAtI5OWgNzB1VocO-jqiHsBtsFSoHTCwU', lang: 'az', kind: 'film' },    // Sənədli filmlər
  { id: 'PLAtI5OWgNzB36qwjeBfvf7i-sDvj1fs63', lang: 'az', kind: 'film' },    // Animasiya filmləri
  { id: 'PLAtI5OWgNzB1VNsoEVz-rdfbPydVbB-Qg', lang: 'az', kind: 'film' },    // Kinoalmanaxlar
  { id: 'PLAtI5OWgNzB16Bgp3_v4WSSmMyyRnG474', lang: 'en', kind: 'film' },    // Films in English
  { id: 'PLAtI5OWgNzB2qF-wUqAn0spyq2C6HLVq0', lang: 'ru', kind: 'film' },    // Фильмы на русском языке
  { id: 'PLAtI5OWgNzB2SGFZKcNcAJYeX7WXYjwXn', lang: 'az', kind: 'trailer' }, // Treylerlər
];
const API = 'https://www.googleapis.com/youtube/v3/';
const INDEX = '/azeri/data/index.json';

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

/* Which of the ids YouTube no longer plays, and the views of the ones it
   does. An id it answers nothing for is gone; one it answers as private is as
   good as gone to anybody pressing Watch. */
async function checked(ids, key) {
  const dead = [];
  const views = {};
  for (let at = 0; at < ids.length; at += 50) {
    const batch = ids.slice(at, at + 50);
    const out = await ask(`videos?part=status,statistics&maxResults=50&id=${batch.join(',')}`, key);
    const alive = new Set();
    for (const v of out.items || []) {
      if (!v.status || v.status.privacyStatus === 'private') continue;
      alive.add(v.id);
      views[v.id] = Number((v.statistics && v.statistics.viewCount) || 0);
    }
    for (const id of batch) if (!alive.has(id)) dead.push(id);
  }
  return { dead, views };
}

export async function onRequestGet(context) {
  const key = youtubeKey(context.env);
  if (!key) return json({ error: 'no-key' }, 503);
  const at = new Date().toISOString();
  try {
    if (new URL(context.request.url).searchParams.get('check') === '1') {
      const ids = (await dataFile(context, INDEX)).linked || [];
      return json({ at, asked: ids.length, ...(await checked(ids, key)) });
    }
    const playlists = [];
    for (const list of PLAYLISTS) playlists.push({ ...list, videos: await playlist(list.id, key) });
    return json({ at, playlists });
  } catch (e) {
    return json({ error: 'youtube', message: String(e.message || e) }, 502);
  }
}
