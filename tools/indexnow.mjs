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
 *   node tools/indexnow.mjs           submit every address in sitemap.xml
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
 * WHY THE SITEMAP AND NOT THE DIFF
 *
 * The addresses come from sitemap.xml rather than from what the push
 * touched, because the map is one page at ten addresses and a changed
 * write-up changes all ten: tools/sitemap.mjs already knows the list, and
 * twenty-five addresses is well inside the ten thousand one request may
 * carry. Zero dependencies, like every tool here.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/* The host, spelled out — README.md under **Getting found** is the list of
   files that name it. */
const SITE = 'https://tallinntastebuds.ee';
const HOST = new URL(SITE).hostname;
const ENDPOINT = 'https://api.indexnow.org/IndexNow';

async function main() {
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

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/json; charset=utf-8' },
    body: JSON.stringify({
      host: HOST,
      key: key,
      keyLocation: SITE + '/indexnow.txt',
      urlList: urls
    })
  });

  /* 200 and 202 both mean "taken"; anything else names what was wrong with
     the request — a key the host did not serve, most likely — and is worth
     a red run. */
  if (res.status !== 200 && res.status !== 202) {
    console.error(`IndexNow answered ${res.status} ${res.statusText} for ${urls.length} addresses.`);
    process.exit(1);
  }
  console.log(`IndexNow took ${urls.length} addresses on ${HOST} (${res.status}).`);
}

main();
