/**
 * Tallinn Tastebuds — Sign in with Apple, for the two iPhone apps.
 *
 * WHY THIS IS A SECOND FILE AND NOT A SECOND HALF OF ./_google.js
 *
 * Google's is a round trip: a browser leaves for Google and comes back with a
 * code, and this Worker swaps the code for a token over a connection of its
 * own. Apple's, from an app, has no trip in it. The phone shows Apple's own
 * sheet, Apple hands the app a signed token, and the app posts that token
 * here. Nothing in ./_google.js — the flow cookie, the state, the redirect —
 * has anything to do.
 *
 * AND SO THE SIGNATURE IS CHECKED HERE, WHERE GOOGLE'S IS NOT
 *
 * readIdToken() in ./_google.js does not verify Google's signature and says
 * why: the token arrived on a TLS connection this Worker opened to Google, so
 * there was nowhere for a forged one to get in. This token arrives from
 * whoever posts it. The signature is the only thing saying Apple wrote it, so
 * it is checked against Apple's published keys, and a token that fails is
 * nobody.
 *
 * WHAT IS CHECKED, AND WHAT EACH CHECK IS FOR
 *
 *   the signature   RS256 under one of Apple's keys, by the `kid` in the
 *                   header: Apple wrote this
 *   iss             Apple's, exactly
 *   aud             one of the apps' bundle ids: Apple wrote it for one of
 *                   these apps, not for some other app the same person
 *                   signed in to, whose developer would otherwise be holding
 *                   a key to their account here
 *   exp             not run out; Apple gives a token ten minutes
 *   nonce           the SHA-256 of the string the app posts beside the token,
 *                   which the app made for this one request and Apple sealed
 *                   into the token: the token was asked for by whoever is
 *                   presenting it
 *   sub             Apple's permanent id for this person with this developer,
 *                   which is the one thing kept — see WHAT IS KEPT
 *
 * WHAT IS KEPT
 *
 * `sub`, in `identities` under the provider 'apple', and nothing else. The
 * app asks Apple for no name and no email, for the reason ./_google.js asks
 * Google for `openid` alone: an account here is a username and a way to
 * prove it is yours.
 *
 * NO SECRET, AND SO NOTHING TO SET
 *
 * A web sign-in with Apple needs a Services ID and a private key to mint a
 * client secret with. This is not that: the app is the client, the token is
 * already signed, and all this side needs is Apple's public keys and the
 * bundle ids of the apps — APP_IDS below, the map's and Kohuke's. So it is on
 * wherever accounts are, with no binding to forget. `APPLE_APP_ID` exists for
 * the one case that needs it — a build signed under another bundle id — and
 * is a comma-separated list that replaces the two.
 */

import { sha256Hex } from './_lib.js';

export const APPLE = 'apple';

const ISSUER = 'https://appleid.apple.com';
const KEYS_URL = 'https://appleid.apple.com/auth/keys';

/* The bundle ids of the two apps that sign in here: the map's, in
   TallinnTasteBuds.xcodeproj, and the flashcards', in Kohuke.xcodeproj in
   etibarhasanov/kohuke. One of them is the `aud` of every token Apple signs
   for either app, and a token made for anything else is refused.

   Two apps, one account: both are under one developer team, and `sub` is
   Apple's id for a person with a team rather than with an app, so somebody
   who signs in to both with Apple is the same row in `identities` and the
   same account, which is the point of Kohuke having no accounts of its own. */
const APP_IDS = ['ee.tallinntastebuds.app', 'ee.tallinntastebuds.kohuke'];

/* How long Apple's keys are trusted without asking again. Apple rotates them
   rarely and publishes the new one beside the old well ahead, and a `kid`
   that is not among the cached ones is looked up fresh once — see keyFor() —
   so this is how stale the common case may be, not how long a rotation takes
   to reach here. */
const KEYS_SECONDS = 3600;

function appIds(env) {
  const set = String((env && env.APPLE_APP_ID) || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return set.length ? set : APP_IDS;
}

/* Whether /api/apple can answer, which /api/account reports as `appApple`
   and the app draws its button by. It needs nothing but accounts themselves —
   see NO SECRET — so this is true wherever it is asked, and it is a function
   all the same: the day it does need something, the app's button follows
   without a release. */
export function appleReady(env) {
  return appIds(env).length > 0;
}

function unb64url(text) {
  const padded = String(text).replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function readJson(part) {
  try {
    const value = JSON.parse(new TextDecoder().decode(unb64url(part)));
    return value && typeof value === 'object' ? value : null;
  } catch (e) {
    return null;
  }
}

async function fetchKeys(fresh) {
  try {
    const res = await fetch(KEYS_URL, fresh ? { cf: { cacheTtl: 0 } } : { cf: { cacheTtl: KEYS_SECONDS, cacheEverything: true } });
    if (!res.ok) return [];
    const body = await res.json();
    return Array.isArray(body && body.keys) ? body.keys : [];
  } catch (e) {
    return [];
  }
}

/* Apple's key by its id. Asked of the cached set first, and of Apple itself
   once more where it is not there: the one time that happens honestly is the
   hour after a rotation, and without the second look every sign-in in that
   hour would fail. */
async function keyFor(kid) {
  const match = (keys) => keys.find((k) => k && k.kid === kid && k.kty === 'RSA');
  return match(await fetchKeys(false)) || match(await fetchKeys(true)) || null;
}

/* Apple's id for whoever this token is about, or '' for a token that does not
   check out. One answer for every way it can fail, as identify() in
   ./_google.js has: nobody was identified. */
export async function appleSubject(env, token, nonce) {
  const parts = String(token || '').split('.');
  if (parts.length !== 3) return '';

  const header = readJson(parts[0]);
  const claims = readJson(parts[1]);
  if (!header || !claims) return '';
  if (header.alg !== 'RS256' || typeof header.kid !== 'string') return '';

  /* The cheap checks first, so a token that is plainly not for here costs no
     request to Apple. None of them is trusted until the signature is. */
  if (claims.iss !== ISSUER) return '';
  if (appIds(env).indexOf(claims.aud) === -1) return '';
  if (typeof claims.exp !== 'number' || claims.exp * 1000 < Date.now()) return '';
  if (typeof claims.sub !== 'string' || !claims.sub) return '';
  if (typeof nonce !== 'string' || !nonce) return '';
  if (claims.nonce !== (await sha256Hex(nonce))) return '';

  const jwk = await keyFor(header.kid);
  if (!jwk) return '';

  try {
    const key = await crypto.subtle.importKey(
      'jwk',
      { kty: 'RSA', n: jwk.n, e: jwk.e, alg: 'RS256', ext: true },
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify']
    );
    const signed = new TextEncoder().encode(parts[0] + '.' + parts[1]);
    const good = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, unb64url(parts[2]), signed);
    return good ? claims.sub : '';
  } catch (e) {
    return '';
  }
}
