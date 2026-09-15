/**
 * Tallinn Tastebuds — signing in through Google.
 *
 * Underscore-prefixed files under functions/ are not routed, so this is a
 * module and never an endpoint. It is everything the Google round trip needs
 * that is not the route itself: what the two sealed cookies carry, the swap
 * of a code for an identity, and the one question the rest of the site asks
 * it — is this configured at all, which it answers strictly enough to also
 * mean *configured with something that could work*. See googleReady().
 *
 * WHY THERE IS NO EMAIL ANYWHERE IN HERE
 *
 * A password reset by email was written for this site once and never ran:
 * Email Sending is not on the Cloudflare free plan, so the whole of it only
 * ever answered "not available" and it was taken out again — see **Accounts**
 * in README.md. This is the other thing an address is usually for, and it
 * needs none: the browser goes to Google, the person signs in *there*, and
 * Google hands this site back a signed statement of who they are. Nothing is
 * sent, so there is nothing to send it with.
 *
 * So the scope asked for is `openid` and nothing else — not `email`, not
 * `profile`. What comes back is the `sub` claim, Google's own permanent id
 * for that person, and that is the whole of what is stored. An account here
 * is still a username and nothing else.
 *
 * WHY THE AUTHORIZATION CODE FLOW AND NOT GOOGLE'S BUTTON
 *
 * Google Identity Services would be a script tag and a credential posted back
 * to the site. This is a redirect, a code, and one server-to-server swap. It
 * costs a page load and buys three things: no third-party script runs on any
 * page of this site, the client secret means a code stolen in transit is
 * worth nothing on its own, and the whole flow is plain fetch and WebCrypto
 * — no library, which is the rule this repo is built on.
 *
 * WHAT THE TWO COOKIES ARE
 *
 *   ttb_g   the flow, set on the way out to Google and read on the way back:
 *           the state to compare, the PKCE verifier, the nonce, where to
 *           return to, and whether this trip is a sign-in or a link. Ten
 *           minutes, and scoped to this route's own path so it rides on
 *           nothing else.
 *   ttb_gp  a Google account that has just proved itself and has no account
 *           here yet, held for as long as it takes to choose a username.
 *           Fifteen minutes, and the only thing in it is the subject.
 *
 * Both are sealed rather than stored: the value carries its own HMAC under
 * SAVE_SALT, so a forged one is refused without a table to check it against.
 * A row per half-finished sign-up would be a table that fills with people who
 * changed their mind, and something to sweep it.
 */

import { hmacHex, sameSecret } from './_lib.js';

/* Google's own endpoints. Discovery would fetch these from
   /.well-known/openid-configuration on every cold start; they have not moved
   in the life of the product and a failed discovery would take the sign-in
   down with it. */
const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';

/* Both spellings are in live use by Google and both are correct — the second
   is what the discovery document names, the first is what older tokens carry. */
const ISSUERS = ['https://accounts.google.com', 'accounts.google.com'];

export const PROVIDER = 'google';

export const FLOW_COOKIE = 'ttb_g';
export const PENDING_COOKIE = 'ttb_gp';

/* Long enough to sign in on a phone that has to fetch a password out of a
   manager, short enough that a tab left open on a shared machine is not a
   way in tomorrow. */
const FLOW_MINUTES = 10;
const PENDING_MINUTES = 15;

/* The route path, which is also the redirect URI registered with Google and
   also the only path the flow cookie is sent on. One constant, because those
   three being the same string is the thing that breaks when it stops being
   true. */
export const GOOGLE_PATH = '/api/google';

/* Every Google client id ends in this, and has through every format Google
   has issued. It is checked as a suffix and not as a whole shape on
   purpose: the part in front of it has been a bare project number and is now
   a number and a hash, and a rule strict enough to refuse a format nobody
   here has seen would turn a working sign-in off — which is a worse failure
   than the one it prevents, because it looks like a decision. */
const CLIENT_ID_SUFFIX = '.apps.googleusercontent.com';

/* The characters an id is made of, which is a different question from the
   shape of it and is safe to be strict about in a way the shape is not. Every
   format Google has issued draws on this set and no other, so refusing what
   falls outside it cannot refuse a real id the way a rule about the
   *arrangement* of those characters could.
 *
   What it does refuse is the corruption trim() cannot reach, because trim()
   reaches the two ends and nothing else: a space in the middle of the id, and
   — the ones that are invisible from every side, including from whoever
   pasted them — a zero-width space, a soft hyphen, or any other character a
   copy out of a rendered page can pick up. All of those still end in the
   suffix, so the check above waves them through, and they arrive at Google
   percent-encoded as `%20`, `%E2%80%8B` or `%C2%AD`: the same *the OAuth
   client was not found* as the trailing newline, with none of its one visible
   cause. An id whose every character is in this set and which ends in the
   suffix is one Google will at least look up, which is the line worth drawing
   — past it the answer is about the console and not about this file. */
const CLIENT_ID_CHARS = /^[A-Za-z0-9._-]+$/;

/* Both values are typed into the Pages dashboard by hand, as secrets, and a
   secret cannot be read back off that page once it is saved. So a trailing
   newline picked up on the way in is invisible from every side afterwards —
   and it is not harmless. The id goes into a query parameter, where a newline
   is percent-encoded rather than ignored, so Google is asked about a client
   called `…googleusercontent.com%0A`, finds no such thing, and says so: *the
   OAuth client was not found*, `Error 401: invalid_client`. An error page
   about an application that does not exist, for a value that is one
   character wrong.
 *
   Trimmed once, here, and nothing reads `env` directly any more. That last
   part is the load-bearing half: the authorize URL, the code swap and the
   `aud` claim all have to agree on the same string, and trimming for the
   first two alone would leave the third refusing a token they had just
   earned.
 *
   Trimming is only the ends, though, and the same paste can carry the same
   damage in the middle where nothing can strip it — CLIENT_ID_CHARS above is
   the half of this that covers that. */
function clientId(env) {
  return String(env.GOOGLE_CLIENT_ID || '').trim();
}

function clientSecret(env) {
  return String(env.GOOGLE_CLIENT_SECRET || '').trim();
}

/* Whether the button may be drawn at all. Both halves or neither: a client id
   with no secret cannot complete the swap, so offering the button would be
   offering a round trip that ends in an error page on Google's side.
 *
   And the id has to look like an id, which is the other way that round trip
   ends on Google's error page rather than on ours. Two tests rather than one,
   and they catch different mistakes: the suffix catches the secret pasted
   into the id's box — the two values come out of adjacent boxes in the Google
   console and go into adjacent boxes in the Cloudflare one, and `GOCSPX-…` is
   a perfectly truthy string that nothing else here could notice — and the
   character set catches a paste that brought something invisible along with
   it. Refusing either reads to a visitor as Google simply not being switched
   on, which is a state this site already has and draws properly; the
   alternative is a button that every visitor can press and nobody can use.
   **Turning it on** in README.md says how to tell the two apart from
   outside. */
export function googleReady(env) {
  const id = clientId(env);
  return !!(
    CLIENT_ID_CHARS.test(id) &&
    id.endsWith(CLIENT_ID_SUFFIX) &&
    clientSecret(env) &&
    env.SAVE_SALT
  );
}

/* ------------------------------------------------------------ the identity
 * The `identities` table, and the whole of what anything asks of it. Three
 * questions and no more: whose account is this Google account, attach it, and
 * take it off again.
 *
 * `provider` is bound rather than interpolated even though it is a constant
 * in this file, because it is the column that stops meaning 'google' the day
 * a second provider exists, and a query written as though it could not is a
 * query somebody has to find again then.
 */

export async function googleUser(env, subject) {
  const row = await env.DB
    .prepare('SELECT user_id FROM identities WHERE provider = ? AND subject = ?')
    .bind(PROVIDER, subject)
    .first();
  return row ? row.user_id : '';
}

export async function linkIdentity(env, subject, userId) {
  await env.DB
    .prepare('INSERT OR IGNORE INTO identities (provider, subject, user_id, created_at) VALUES (?, ?, ?, ?)')
    .bind(PROVIDER, subject, userId, Date.now())
    .run();
}

/* By the account and not by the subject: the account page is what presses
   this, it knows who it is, and it does not know — and has no business
   knowing — which Google account is behind the row. */
export async function unlinkGoogle(env, userId) {
  await env.DB
    .prepare('DELETE FROM identities WHERE provider = ? AND user_id = ?')
    .bind(PROVIDER, userId)
    .run();
}

export async function hasGoogle(env, userId) {
  const row = await env.DB
    .prepare('SELECT 1 AS x FROM identities WHERE provider = ? AND user_id = ?')
    .bind(PROVIDER, userId)
    .first();
  return !!row;
}

/* ------------------------------------------------------------- the sealing
 * base64url of the JSON, a dot, and an HMAC of that under SAVE_SALT. The
 * browser is holding it, so it has to be unforgeable; nothing else reads it,
 * so it does not have to be readable.
 */

function b64url(bytes) {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function unb64url(text) {
  const padded = text.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/* Private on purpose: everything outside this file wants one of the two
   below, which pair the value's own expiry with the cookie carrying it. A
   seal with a lifetime of the caller's choosing is the thing that got those
   two out of step. */
async function seal(secret, payload) {
  const body = b64url(new TextEncoder().encode(JSON.stringify(payload)));
  return body + '.' + (await hmacHex(secret, body));
}

/* One per cookie, because a sealed value and the cookie carrying it have to
   run out at the same moment. They were two separate numbers for a while — an
   `exp` the caller put in the payload and a `Max-Age` the cookie builder put
   on the header — and nothing at all held the two together, so a change to one
   would have left a value the browser keeps sending and this file refuses, or
   the other way about. Now each lifetime is written once, here. */
export async function sealFlow(secret, payload) {
  return seal(secret, Object.assign({}, payload, { exp: Date.now() + FLOW_MINUTES * 60000 }));
}

export async function sealPending(secret, payload) {
  return seal(secret, Object.assign({}, payload, { exp: Date.now() + PENDING_MINUTES * 60000 }));
}

/* Null for anything that is not a value this site sealed and has not expired:
   a wrong signature, a payload that is not JSON, a cookie somebody kept. The
   caller never has to tell those apart — all three mean start again. */
export async function unseal(secret, text) {
  const raw = String(text || '');
  const at = raw.indexOf('.');
  if (at === -1) return null;

  const body = raw.slice(0, at);
  const mac = raw.slice(at + 1);
  if (!sameSecret(await hmacHex(secret, body), mac)) return null;

  let payload;
  try {
    payload = JSON.parse(new TextDecoder().decode(unb64url(body)));
  } catch (e) {
    return null;
  }
  if (!payload || typeof payload !== 'object') return null;
  if (typeof payload.exp !== 'number' || payload.exp < Date.now()) return null;
  return payload;
}

/* SameSite=Lax and not Strict, which is the one attribute here that is not
   simply the safest available: Strict withholds the cookie from a navigation
   that started on another site, and the navigation that matters is the one
   Google sends back. Lax allows exactly that — a top-level GET — and nothing
   else, which is the shape of this flow and no more.

   The path is the route's own for the flow cookie, so it is not attached to
   every request the site makes; the pending one is site-wide because the
   username it is waiting for is posted to /api/account. Neither is
   domain-scoped the way the session cookie is: a round trip begins and ends
   on one host, and the session it eventually mints is what has to cover
   both hosts. */
function cookie(name, value, minutes, path) {
  return [
    name + '=' + (value || ''),
    'Path=' + path,
    'HttpOnly',
    'Secure',
    'SameSite=Lax',
    'Max-Age=' + (value ? minutes * 60 : 0)
  ].join('; ');
}

export function flowCookie(value) {
  return cookie(FLOW_COOKIE, value, FLOW_MINUTES, GOOGLE_PATH);
}

export function pendingCookie(value) {
  return cookie(PENDING_COOKIE, value, PENDING_MINUTES, '/');
}

/* -------------------------------------------------------------- the trip
 * PKCE, which this flow does not strictly need — the code is redeemed by a
 * server holding a client secret, which is the thing PKCE exists to stand in
 * for — and carries anyway. It costs one hash and it closes the case where a
 * code leaks out of a redirect (a referrer, a shared screen, a browser
 * extension) and is redeemed by somebody who also has the secret out of a
 * deployment somewhere. Google recommends it for every client, and there is
 * no reason to be the exception.
 */
export async function pkce() {
  const verifier = b64url(crypto.getRandomValues(new Uint8Array(32)));
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return { verifier, challenge: b64url(new Uint8Array(digest)) };
}

export function authorizeUrl(env, { redirectUri, state, nonce, challenge }) {
  const url = new URL(AUTH_URL);
  url.searchParams.set('client_id', clientId(env));
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('response_type', 'code');
  /* The minimum Google accepts, and the minimum this site has a use for. An
     address or a display name would arrive in the same answer and be thrown
     away, which is worse than not asking: the consent screen would name them
     and somebody would reasonably believe this site now has them. */
  url.searchParams.set('scope', 'openid');
  url.searchParams.set('state', state);
  url.searchParams.set('nonce', nonce);
  url.searchParams.set('code_challenge', challenge);
  url.searchParams.set('code_challenge_method', 'S256');
  /* Somebody signing in has usually got more than one Google account, and the
     site cannot know which of them they mean this one to be. Connecting a
     second way into an account that already exists is the case where guessing
     is worst: it would attach whichever account the browser happens to be
     signed into. */
  url.searchParams.set('prompt', 'select_account');
  return url.toString();
}

/* The code for an identity, or null. Everything that can go wrong here —
   Google refusing the swap, an answer that is not JSON, a token that does not
   check out — is the same outcome for the caller, which is that nobody was
   identified. */
export async function identify(env, { code, verifier, redirectUri, nonce }) {
  let token;
  try {
    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId(env),
        client_secret: clientSecret(env),
        code_verifier: verifier,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri
      })
    });
    if (!res.ok) return null;
    token = await res.json();
  } catch (e) {
    return null;
  }

  return readIdToken(env, token && token.id_token, nonce);
}

/* THE SIGNATURE IS NOT CHECKED, AND THAT IS NOT AN OVERSIGHT
 *
 * The token did not come through the browser. It came back on a TLS
 * connection this Worker opened to Google's own token endpoint, authenticated
 * with the client secret, in the response to the request carrying the code.
 * There is nowhere in that path for a token of somebody else's making to get
 * in, and OpenID Connect says so in as many words (Core 3.1.3.7, item 6): a
 * client that gets the token straight from the token endpoint may treat the
 * TLS as the validation. Fetching Google's signing keys and verifying against
 * them would be a JWKS cache, a key rotation to get wrong, and two more ways
 * for a sign-in to fail, to learn nothing the connection has not already
 * said.
 *
 * What is checked is what TLS does not cover: that the token is for this
 * client, from this issuer, not expired, and carrying the nonce this browser
 * was sent with — which is what ties it to the trip that started here.
 */
function readIdToken(env, idToken, nonce) {
  const parts = String(idToken || '').split('.');
  if (parts.length !== 3) return null;

  let claims;
  try {
    claims = JSON.parse(new TextDecoder().decode(unb64url(parts[1])));
  } catch (e) {
    return null;
  }

  if (!claims || typeof claims.sub !== 'string' || !claims.sub) return null;
  if (ISSUERS.indexOf(claims.iss) === -1) return null;
  if (claims.aud !== clientId(env)) return null;
  if (typeof claims.exp !== 'number' || claims.exp * 1000 < Date.now()) return null;
  if (claims.nonce !== nonce) return null;

  return { provider: PROVIDER, subject: claims.sub };
}
