#!/usr/bin/env node
/**
 * Tallinn Tastebuds — tell Bing what changed.
 *
 * Bing does not crawl a small site often, and everything downstream of Bing
 * — DuckDuckGo, Copilot, ChatGPT's search — waits on Bing. IndexNow is the
 * protocol Bing, Yandex, Seznam and Naver share for being told instead: one
 * POST naming the addresses that changed, and the crawler comes for them in
 * minutes rather than weeks. Google does not take part, and has said it will
 * not; Search Console and the sitemap are Google's road.
 *
 *   node tools/indexnow.mjs
 *       submit every address in sitemap.xml, once the key is live
 *   node tools/indexnow.mjs --probe <origin> --endpoint <url> --wait <ms>
 *       the same, against a stub: where to read the key back from, where to
 *       POST, and how long to wait for the key. For driving a change to this
 *       file without deploying anything; the workflow passes none of them.
 *
 * .github/workflows/indexnow.yml runs it on every push to the production
 * branch, which is every deploy, so it is never run by hand on purpose. It
 * can be, harmlessly: submitting an address that has not changed costs
 * nothing and changes nothing.
 *
 * THE KEY IS NOT A SECRET
 *
 * indexnow.txt at the root holds the key, and the same key goes in the
 * request. That is the whole of the protocol's proof: only somebody who can
 * put a file on tallinntastebuds.ee can have written that file, so the
 * request must be theirs. It is public by design — the file is fetched by
 * Bing to check — which is why it is committed, why there is nothing in the
 * repository's secret store for this, and why it goes on being fine for
 * anybody to read. Minting a new one is `node -e` and thirty-two hex
 * characters; the old file is simply replaced.
 *
 * IT WAITS FOR THE DEPLOY FIRST
 *
 * The workflow runs on the push, and a push is a deploy that has not happened
 * yet: Cloudflare takes a minute or so to put the commit live. On the day the
 * key was born, the first run told Bing to go and read a key file that was
 * not on the site yet. IndexNow answers 202 to any submission — "received,
 * key validation pending" — then fetches the key on its own time; it found
 * nothing, and refused that key with 403 on every submission after. Three
 * red runs in a row, on commits that had not touched a thing near it.
 *
 * So before it submits anything, this asks the live site for the key file
 * and waits until what comes back is the key this tree holds — up to WAIT_MS,
 * asking every EVERY_MS. On the ordinary push, where the key has not changed,
 * that is one request and no wait at all. On a push that minted a new key it
 * is the wait for the deploy, which is the whole point. The sitemap is not
 * waited for: a commit that adds a place may be submitted a few seconds before
 * the page is live, and Bing crawls minutes later anyway.
 *
 * A 403 after the key was confirmed served is a different animal. Bing could
 * not fetch what this tool just fetched, which means the host is answering
 * Bing's fetcher differently from a GitHub runner — a firewall rule or bot
 * protection in front of the zone — and the message says so, because nothing
 * in this repository can fix that.
 *
 * WHY THE SITEMAP AND NOT THE DIFF
 *
 * The addresses come from sitemap.xml rather than from what the push
 * touched, because the map is one page at ten addresses and a changed
 * write-up changes all ten: tools/sitemap.mjs already knows the list, and a
 * hundred addresses is well inside the ten thousand one request may carry.
 * Zero dependencies, like every tool here.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/* The host, spelled out — README.md under **Getting found** is the list of
   files that name it. Bing is always told to fetch the key from here,
   whatever --probe says: --probe is where THIS tool reads it back from. */
const SITE = 'https://tallinntastebuds.ee';
const HOST = new URL(SITE).hostname;
const ENDPOINT = 'https://api.indexnow.org/IndexNow';

/* Up to six minutes, asking every ten seconds. A Pages deploy is usually live
   inside two; six is the point past which it has failed for a reason this
   tool cannot see, and a red run saying so is the right answer. */
const WAIT_MS = 6 * 60 * 1000;
const EVERY_MS = 10 * 1000;

/* --probe, --endpoint and --wait, or the live site, Bing and the numbers
   above. Anything else on the command line is a mistake worth stopping for. */
function flags() {
  const out = { probe: SITE, endpoint: ENDPOINT, wait: WAIT_MS };
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i += 2) {
    const name = argv[i].replace(/^--/, '');
    const value = argv[i + 1];
    if (!(name in out) || value === undefined) {
      console.error('usage: node tools/indexnow.mjs [--probe <origin>] [--endpoint <url>] [--wait <ms>]');
      process.exit(2);
    }
    out[name] = name === 'wait' ? Number(value) : value;
  }
  return out;
}

const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

/* The key file as the live site serves it right now, or null: not there yet,
   not answering, or not a 200. A cache-busting query, so nothing between here
   and the edge hands back yesterday's file. */
async function liveKey(probe) {
  try {
    const res = await fetch(probe + '/indexnow.txt?' + Date.now());
    if (!res.ok) return null;
    return (await res.text()).trim();
  } catch (e) {
    return null;
  }
}

async function untilLive(probe, key, wait) {
  const until = Date.now() + wait;
  for (;;) {
    const got = await liveKey(probe);
    if (got === key) return;
    if (Date.now() >= until) {
      const s = Math.round(wait / 1000);
      console.error(got === null
        ? `${probe}/indexnow.txt never answered in ${s}s — the deploy has not happened, or the file is not being served.`
        : `${probe}/indexnow.txt is still another key after ${s}s — the deploy carrying this tree's indexnow.txt has not happened.`);
      process.exit(1);
    }
    await sleep(Math.min(EVERY_MS, Math.max(500, wait / 4)));
  }
}

async function main() {
  const { probe, endpoint, wait } = flags();

  const key = readFileSync(join(ROOT, 'indexnow.txt'), 'utf8').trim();
  if (!/^[a-f0-9]{8,128}$/.test(key)) {
    console.error('indexnow.txt must hold eight to a hundred and twenty-eight hex characters and nothing else.');
    process.exit(1);
  }

  const sitemap = readFileSync(join(ROOT, 'sitemap.xml'), 'utf8');
  const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)]
    .map((m) => m[1].replace(/&amp;/g, '&'))
    .filter((url) => new URL(url).hostname === HOST);
  if (!urls.length) {
    console.error('sitemap.xml names no address on ' + HOST + ' — nothing to submit.');
    process.exit(1);
  }

  await untilLive(probe, key, wait);
  console.log(`${probe}/indexnow.txt serves this tree's key.`);

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json; charset=utf-8' },
    body: JSON.stringify({
      host: HOST,
      key: key,
      keyLocation: SITE + '/indexnow.txt',
      urlList: urls
    })
  });

  /* 200 and 202 both mean "taken" — 202 is Bing not having checked the key
     yet, which it does on its own time. A 403 with the key confirmed live is
     the one answer worth more than its number; anything else names what was
     wrong with the request. */
  if (res.status === 200 || res.status === 202) {
    console.log(`IndexNow took ${urls.length} addresses on ${HOST} (${res.status}${res.status === 202 ? ', key validation pending' : ''}).`);
    return;
  }
  if (res.status === 403) {
    console.error(`IndexNow answered 403 Forbidden for ${urls.length} addresses, though ${probe}/indexnow.txt serves this key. ` +
      'Bing is being answered differently from this runner: look at what stands in front of the zone on /indexnow.txt ' +
      '— a firewall rule or bot protection — and, if the key was minted just now, give Bing a few minutes to re-check it.');
    process.exit(1);
  }
  console.error(`IndexNow answered ${res.status} ${res.statusText} for ${urls.length} addresses.`);
  process.exit(1);
}

main();
