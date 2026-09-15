/**
 * Tallinn Tastebuds — /api/google, the whole of the round trip to Google.
 *
 * ONE ROUTE AND NOT TWO, WHICH IS THE ONE THING WORTH NOTICING HERE
 *
 * A browser asks this route twice for every sign-in: once on the way out,
 * with nothing, and once on the way back, with Google's `code` in the query.
 * Those are the same address, so this is one file and — the part that
 * actually matters — one redirect URI to register in the Google Cloud
 * console per hostname, instead of a pair that has to be kept in step with
 * the route names. `GOOGLE_PATH` in ./_google.js is that one string.
 *
 * WHAT COMES BACK, AND HOW A PAGE HEARS ABOUT IT
 *
 * Every ending is a redirect to where the trip started — the `?then=` the
 * button carried, always a path on this site — with one parameter saying
 * what happened:
 *
 *   ?google=in      signed in; the page says who, and this device's saves
 *                   have been claimed the way a password sign-in claims them
 *   ?google=name    this Google account has never been here. The sheet asks
 *                   for a username and posts it to /api/account
 *   ?google=linked  connected to the account that was already signed in
 *   ?google=taken   that Google account is already somebody else's here
 *   ?google=failed  the swap did not complete
 *
 * and nothing at all where somebody pressed Cancel on Google's own screen,
 * because changing your mind is not an error and should not come back as one.
 *
 * There is no JSON answer anywhere in this file. Every one of these endings
 * is a navigation, so what a browser gets is a page, and the page is the one
 * they were standing on.
 *
 * WHY A SIGN-IN CANNOT QUIETLY BECOME A LINK
 *
 * The intent is decided on the way *out*, from whether the request carried a
 * session, and sealed into the flow cookie. Deciding it on the way back —
 * "is there a session now?" — would mean a browser that signed in on another
 * tab mid-trip silently attaches somebody's Google account to whatever
 * account happened to be open. Sealed at the start, it is the question the
 * person actually answered.
 */

import {
  sessionUser, wrongDatabase, readCookie, openSession, sessionCookie,
  claimDeviceSaves, SESSION_DAYS, countsKey
} from './_lib.js';
import {
  googleReady, googleUser, linkIdentity, PROVIDER, GOOGLE_PATH,
  FLOW_COOKIE, flowCookie, pendingCookie,
  sealFlow, sealPending, unseal, pkce, authorizeUrl, identify
} from './_google.js';

/* A path on this site and nothing else, which is the rule ?then= keeps on the
   map and for the same reason: a parameter that could name any URL turns this
   route into an open redirector, and one that lands on somebody else's site
   immediately after a sign-in is the most convincing phishing page there is.
 *
   It is checked the way assets/app.js checks it rather than with a pattern
   about what a path may not contain — strip what a browser strips, resolve
   against this origin, and look at where it actually points. A rule about
   characters has to keep pace with every parser quirk; asking the parser does
   not. See samePlace() there, which carries the whole of that argument. */
function safePath(raw, origin) {
  const candidate = String(raw || '')
    .replace(/^[\x00-\x20]+|[\x00-\x20]+$/g, '')
    .replace(/[\t\n\r]/g, '');
  if (candidate.charAt(0) !== '/') return '/';

  let url;
  try {
    url = new URL(candidate, origin);
  } catch (e) {
    return '/';
  }
  if (url.origin !== origin) return '/';
  return url.pathname + url.search + url.hash;
}

/* Back where they came from, with one word about what happened. */
function land(origin, then, outcome, cookies) {
  const url = new URL(then, origin);
  if (outcome) url.searchParams.set('google', outcome);

  const headers = new Headers({ location: url.toString(), 'cache-control': 'no-store' });
  /* Always at least the flow cookie, cleared: a trip that has ended must not
     leave a state and a verifier standing for the next one to trip over. */
  for (const c of cookies) headers.append('set-cookie', c);
  return new Response(null, { status: 302, headers });
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const origin = url.origin;

  /* Hand-typed, or a button drawn by a page that loaded before the deployment
     lost its bindings. Home, quietly: there is no sheet to put an error on
     when the thing that draws the sheet is what is missing. */
  if (!env.DB || !googleReady(env) || (await wrongDatabase(env))) {
    return land(origin, '/', '', [flowCookie('')]);
  }

  const code = url.searchParams.get('code') || '';
  const state = url.searchParams.get('state') || '';
  const failure = url.searchParams.get('error') || '';

  /* Nothing from Google in the query means this is the way out, not the way
     back. The two directions are the same address — see the header. */
  if (!code && !state && !failure) return depart(context, url, origin);
  return arrive(context, url, origin, { code, state, failure });
}

/* ------------------------------------------------------------- the way out */
async function depart(context, url, origin) {
  const { request, env } = context;

  const then = safePath(url.searchParams.get('then'), origin);
  /* The device's own id, so that whatever this browser saved before anybody
     signed in can be claimed on the way back — exactly what the `client`
     field does on a password sign-in. It goes into the sealed cookie rather
     than travelling to Google and back: Google is sent the state and the
     challenge and nothing else about this browser. */
  const client = url.searchParams.get('client') || '';

  /* Signed in already means this is a connect and not a sign-in, and that is
     settled here rather than on the way back. See the header. */
  const user = await sessionUser(request, env);

  const state = crypto.randomUUID();
  const nonce = crypto.randomUUID();
  const { verifier, challenge } = await pkce();

  const sealed = await sealFlow(env.SAVE_SALT, {
    state,
    nonce,
    verifier,
    then,
    client,
    intent: user ? 'link' : 'in'
  });

  const off = new Headers({
    location: authorizeUrl(env, {
      redirectUri: origin + GOOGLE_PATH,
      state,
      nonce,
      challenge
    }),
    'cache-control': 'no-store'
  });
  off.append('set-cookie', flowCookie(sealed));
  /* And any half-finished sign-up from a trip before this one, cleared. A new
     trip supersedes it: somebody who reached the name step with one Google
     account and then started again with another would otherwise still be
     holding a note for the first, and the sheet could be talked into naming
     an account for a person who is no longer the one signing in. */
  off.append('set-cookie', pendingCookie(''));

  return new Response(null, { status: 302, headers: off });
}

/* ------------------------------------------------------------ the way back */
async function arrive(context, url, origin, { code, state, failure }) {
  const { request, env } = context;
  const clear = flowCookie('');

  const flow = await unseal(env.SAVE_SALT, readCookie(request, FLOW_COOKIE));
  /* No cookie, a forged one, or one from a trip that started more than ten
     minutes ago. There is nowhere trustworthy to send them but the front of
     the site: `then` lives in the cookie, so a missing cookie is also a
     missing destination. */
  if (!flow) return land(origin, '/', 'failed', [clear]);

  const then = safePath(flow.then, origin);

  /* Pressing Cancel on Google's screen. A decision, not a fault: back where
     they were, with nothing said about it. */
  if (failure === 'access_denied') return land(origin, then, '', [clear]);
  if (failure || !code) return land(origin, then, 'failed', [clear]);

  /* What the state parameter is for: this answer belongs to the trip this
     browser started, and not to one somebody else started in a link. */
  if (state !== flow.state) return land(origin, then, 'failed', [clear]);

  const identity = await identify(env, {
    code,
    verifier: flow.verifier,
    nonce: flow.nonce,
    redirectUri: origin + GOOGLE_PATH
  });
  if (!identity) return land(origin, then, 'failed', [clear]);

  if (flow.intent === 'link') return connect(context, origin, then, identity, clear);
  return signIn(context, origin, then, identity, flow.client, clear);
}

/* Connecting Google to the account that started the trip signed in. */
async function connect(context, origin, then, identity, clear) {
  const { request, env } = context;

  const user = await sessionUser(request, env);
  /* The session ran out during the trip, which is a ten-minute window and so
     is rare rather than impossible. Signing them in as this Google account
     instead would be connecting nothing to nothing. */
  if (!user) return land(origin, then, 'failed', [clear]);

  const owner = await googleUser(env, identity.subject);
  /* One Google account is one account here. Letting it point at a second
     would make "sign in with Google" a question with two answers, and the
     route would have to pick one. */
  if (owner && owner !== user.id) return land(origin, then, 'taken', [clear]);

  if (!owner) await linkIdentity(env, identity.subject, user.id);
  return land(origin, then, 'linked', [clear]);
}

/* Signing in, or finding out there is nobody here to sign in as yet. */
async function signIn(context, origin, then, identity, client, clear) {
  const { request, env } = context;

  const userId = await googleUser(env, identity.subject);

  /* Never been here. Nothing is written — no half-made account, and no row to
     sweep when somebody closes the tab on this step — and what is handed back
     instead is a sealed note saying which Google account proved itself, good
     for fifteen minutes. The username is the one thing this site asks anybody
     to decide, and it is asked for on the sheet rather than assembled out of
     a Google profile this route deliberately never asked for. */
  if (!userId) {
    const pending = await sealPending(env.SAVE_SALT, {
      provider: PROVIDER,
      subject: identity.subject
    });
    return land(origin, then, 'name', [clear, pendingCookie(pending)]);
  }

  await env.DB.prepare('UPDATE users SET last_seen_at = ? WHERE id = ?').bind(Date.now(), userId).run();

  /* The same claim a password sign-in makes: what this browser saved before
     anybody signed in moves onto the account, merged rather than doubled. */
  const touched = await claimDeviceSaves(env, userId, client);
  if (touched.length) context.waitUntil(caches.default.delete(countsKey(request)));

  const token = await openSession(env, userId);
  return land(origin, then, 'in', [clear, sessionCookie(token, SESSION_DAYS, request)]);
}
