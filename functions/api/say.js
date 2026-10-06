/**
 * Tallinn Tastebuds — an Estonian word or sentence off a flashcard, said
 * aloud.
 *
 * GET /api/say?text=Ma%20tahan%20musta%20leiba
 *   → 200 audio/wav, the sentence in Mari's voice
 *   → 206 audio/wav, a slice of it, when the request asks for a Range —
 *                                     which an iPhone always does: answer()
 *   → 404 { "error": "not-a-card" }   the text is not on any shipped card
 *   → 502 { "error": "no-voice" }     the voice did not answer, or took
 *                                     longer than WAIT_MS to
 *
 * The flashcards put Estonian in front of people who have never heard it, and
 * a word read is half a word: *leib* and *leiba* are one thing on the page and
 * two in the mouth. The button under the card asks this route for the front,
 * and for the sentence on the back where a card has one; the speaker beside
 * each sentence of a grammar lesson asks for that sentence, and a form in a
 * lesson's paradigm, pressed, asks for itself — see sayLine(), examples() and
 * paradigm() in assets/flashcard.js and **Hearing it** under **Flashcards**
 * in README.md.
 *
 * WHOSE VOICE, AND WHY NOT OURS
 *
 * TartuNLP's Neurokõne, the University of Tartu's neural Estonian text-to-
 * speech, which is free, needs no key, and is the best Estonian voice there is
 * to be had without paying — the browser's own speechSynthesis has no Estonian
 * voice on most phones, Workers AI's text-to-speech speaks no Estonian at all,
 * and the paid ones (Azure's Anu and Kert) are a bill for a feature on a site
 * that has none. It is a research group's public endpoint with no promise of
 * uptime, which is what the 502 below is for: the page says the voice is not
 * answering and the card goes on working without it.
 *
 * Mari, the one voice for now. VOICE is one constant rather than a parameter
 * so that the day a man's voice is wanted as well — Albert is the obvious one
 * — it is a `voice` query checked against a list here and a switch on the
 * page, and the cache key below already carries it.
 *
 * NOTHING IS STORED, AND THE CACHE IS WHY THAT IS FINE
 *
 * No row, no bucket, no file in the repository: a card's sound exists when
 * somebody presses the button and is kept in Cloudflare's cache after that,
 * keyed on the voice and the words. So "Tere" goes to Tartu once per data
 * centre a month, and everybody after the first is answered from the edge in
 * the time a photo takes. The words on a card change only when data/decks.json
 * does, and a changed card is different words and so a different key, which
 * means nothing here ever needs purging.
 *
 * It is a route rather than a fetch from the browser for that cache, and for
 * two more reasons. The upstream is a POST, which neither a browser's cache
 * nor Cloudflare's will keep, and this turns it into a GET that both do — the
 * page just hands the address to an <audio>. And whether Tartu answers a
 * browser on another origin at all was a question nobody here could put to it.
 *
 * ONLY WHAT IS ON A CARD
 *
 * An open text-to-speech proxy on a university's goodwill is a thing that
 * gets found and used, so the text has to be the front of a card in
 * data/decks.json, the Estonian of a card's sentence, a sentence or a form out
 * of a grammar lesson, or a line of a song in the same file, exactly. The list
 * of those is data/decks/spoken.json, which tools/decks.mjs writes out of the
 * source — this route used to read the whole file and gather them itself, a
 * megabyte parsed to answer whether one line was on a card — and it is the
 * only thing this route reads. Nothing a person typed is ever spoken: a deck
 * somebody wrote is not in that file, and speaking it would mean saying
 * anything anybody chose. That is a decision for a description rather than
 * for this file — **What it does not do** under **Flashcards**.
 */

import { json, dataFile } from './_lib.js';

const ENDPOINT = 'https://api.tartunlp.ai/text-to-speech/v2';

const VOICE = 'mari';

/* The voice's own pace. It was 0.9 at first, a little under natural for
   people learning the word, and it came back sounding more robotic for it —
   on an iPhone and on a computer alike, and on words and sentences the same.
   Tartu takes a multiplier between 0.5 and 2, and anything but 1 asks the
   model for a pace it was not trained at. */
const SPEED = 1;

/* Thirty days, at the browser and at the edge. Both keep a recording by what
   it is — the edge by the voice, the pace and the words, the browser by an
   address carrying SAY_TAKE in assets/flashcard.js — so a change to how it
   sounds is a new key rather than a stale copy, and a shorter life would buy
   nothing but a fresher copy of an identical recording. */
const CACHE_SECONDS = 2592000;

/* The longest thing on a card is a sentence of a hundred-odd characters. Past
   this nothing is looked up at all. */
const MAX_TEXT = 300;

/* A sentence takes Tartu a second or two. A voice that has taken fifteen is
   not going to answer, and without this the press would breathe for as long
   as the connection stayed open rather than saying so. */
const WAIT_MS = 15000;

/* Sent so Tartu can see who is asking — the courtesy functions/api/geocode.js
   extends to Komoot, for the same reason. */
const AGENT = 'TallinnTastebuds/1.0 (+https://tallinntastebuds.ee)';

const HEADERS = {
  'content-type': 'audio/wav',
  'cache-control': 'public, max-age=' + CACHE_SECONDS,
  'accept-ranges': 'bytes'
};

/* Every string a card may ask to hear, as the list tools/decks.mjs writes —
   the front of every card, the Estonian of its sentence, a lesson's sentences
   and its forms as the page asks for them, a song's lines — and as the Set it
   is asked against, built once per copy of the file. dataFile() hands back
   the same array for five minutes, so a WeakMap keyed on it rebuilds the set
   exactly when a new deploy's words arrive. A file that is not a list is an
   empty set, and every text is then not a card. */
const SPOKEN_FILE = '/data/decks/spoken.json';
const spoken = new WeakMap();

function sayable(list) {
  if (!Array.isArray(list)) return new Set();
  let set = spoken.get(list);
  if (set) return set;
  set = new Set(list.filter((text) => typeof text === 'string'));
  spoken.set(list, set);
  return set;
}

/* The recording, whole, or the slice of it a Range header asks for.
 *
 * Safari fetches media a range at a time, and its first request for any of it
 * is for two bytes — bytes=0-1 — to find out whether the server can. Apple's
 * own guide says in as many words that a server hosting media for iOS must
 * answer that, and an iPhone handed the whole file instead may simply not
 * play it. So a Range is honoured, on a hit and on a miss alike, out of the
 * recording this route already holds in full. Chrome and Firefox ask for
 * bytes=0- or for nothing, and get all of it either way.
 *
 * One range, the only shape a media element sends; a list of several is
 * answered whole, which the specification allows. */
function answer(request, sound) {
  const asked = /^bytes=(\d*)-(\d*)$/.exec(request.headers.get('range') || '');
  if (!asked || (asked[1] === '' && asked[2] === '')) return new Response(sound, { headers: HEADERS });

  const size = sound.byteLength;
  let start;
  let end;
  if (asked[1] === '') {
    /* bytes=-500 is the last five hundred. */
    start = Math.max(0, size - Number(asked[2]));
    end = size - 1;
  } else {
    start = Number(asked[1]);
    end = asked[2] === '' ? size - 1 : Math.min(Number(asked[2]), size - 1);
  }
  if (start > end) {
    return new Response(null, { status: 416, headers: { 'content-range': 'bytes */' + size } });
  }
  return new Response(sound.slice(start, end + 1), {
    status: 206,
    headers: { ...HEADERS, 'content-range': 'bytes ' + start + '-' + end + '/' + size }
  });
}

export async function onRequestGet(context) {
  const { request } = context;
  const text = String(new URL(request.url).searchParams.get('text') || '').trim();
  if (!text || text.length > MAX_TEXT) return json({ error: 'not-a-card' }, 404);

  let file;
  try {
    file = await dataFile(context, SPOKEN_FILE);
  } catch (e) {
    return json({ error: 'no-voice' }, 502);
  }
  if (!sayable(file).has(text)) return json({ error: 'not-a-card' }, 404);

  /* The key is an address of our own, not the request's, so a stray
     parameter on the way in cannot make a second copy — the page's own take=
     included. It carries everything that changes the sound, the voice and the
     pace, so a change to either is a new recording at the edge the day it
     deploys; the browser's copy is SAY_TAKE's to replace, and changing either
     of these means bumping that too. */
  const key = new Request(new URL('/api/say?voice=' + VOICE + '&speed=' + SPEED + '&text=' + encodeURIComponent(text), request.url).toString());
  const cache = caches.default;
  const kept = await cache.match(key);
  if (kept) return answer(request, await kept.arrayBuffer());

  let sound;
  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'audio/wav', 'user-agent': AGENT },
      body: JSON.stringify({ text: text, speaker: VOICE, speed: SPEED }),
      signal: AbortSignal.timeout(WAIT_MS)
    });
    if (!res.ok) return json({ error: 'no-voice' }, 502);
    sound = await res.arrayBuffer();
  } catch (e) {
    return json({ error: 'no-voice' }, 502);
  }
  if (!sound.byteLength) return json({ error: 'no-voice' }, 502);

  /* Kept whole, whatever slice this request wanted, and awaited rather than
     left to waitUntil(). Safari's second request for a recording arrives the
     moment the two bytes of its first one do, and a put still running behind
     the answer would make that second request a miss — every word
     synthesised twice, on exactly the phone that waits longest for it. The copy is
     because the cache and the answer each want a body of their own. */
  try {
    await cache.put(key, new Response(sound.slice(0), { headers: HEADERS }));
  } catch (e) {
    /* Answered uncached; the next press asks Tartu again, and nothing else. */
  }
  return answer(request, sound);
}
