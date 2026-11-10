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
 *   ?google=new     this Google account had never been here, and now has
 *                   an account under a name drawn for it, signed in — the
 *                   page says who, the way it does for `in`, and counts an
 *                   account made rather than a sign-in
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
 * THE ONE TRIP THAT DOES NOT END ON A PAGE
 *
 * The iPhone app's. It starts the trip with `?app=<challenge>`, in the
 * system's sign-in sheet, and every ending of it is `tallinntastebuds://signin`
 * rather than `?then=`: the same `google=` outcomes, and a `ticket` in place
 * of the session cookie where somebody signed in, which the app trades for
 * the session at /api/account. It never links — a session found in the sheet
 * is the browser's, not the app's. THE APP'S WAY BACK IN in ./_google.js is
 * the whole argument.
 *
 * AND WHEN IT IS OFF
 *
 * Without a usable GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET — googleReady()
 * in ./_google.js, both halves or neither — /api/account answers
 * `google: false` and every sheet draws the username and password alone, so
 * nothing sends anybody here. A request that arrives anyway, hand-typed or
 * from a page that loaded before the bindings went, is sent home with nothing
 * said; so is one with no database behind it.
 *
 * WHY A SIGN-IN CANNOT QUIETLY BECOME A LINK
 *
 * The intent is decided on the way *out*, from whether the request carried a
 * session, and sealed into the flow cookie. Deciding it on the way back —
 * "is there a session now?" — would mean a browser that signed in on another
 * tab mid-trip silently attaches somebody's Google account to whatever
 * account happened to be open. Sealed at the start, it is the question the
 * person actually answered. A trip the app started is sealed as a sign-in
 * whatever it carried, for the reason above.
 *
 * AND WHAT IT COUNTS
 *
 * A page that sends somebody to Google cannot see what happened to them
 * there, and one that never sees them back cannot report anything at all.
 * This route sees both ends, so it counts both: `google_out` for a sign-in
 * that left, `google_out_inapp` beside it where it left from the in-app
 * browser of Instagram, Facebook or TikTok, and `google_back_<word>` for how
 * one came back — `in`, `new`, `cancel`, `failed` — into the sign-up funnel
 * on /admin/visitors. The in-app count is there because Google refuses to
 * sign anybody in inside those browsers (`disallowed_useragent`) and never
 * redirects back, and between 8 October and 5 November eleven of eighteen
 * trips out never came back while the site's arrivals were mostly those
 * three apps; it is the number that says whether that is why. inAppOf() in
 * ./_visits.js is the test, the same one sourceOf() files a visit by.
 * SIGNING UP in ./_visitors.js is the whole of it. A connect, which is
 * somebody already signed in, is not a sign-up and is counted nowhere, and
 * neither is the owner coming back in, whom the route can tell only once
 * Google has said who they are — a trip out of theirs is one google_out
 * too many, which is the price of not asking the database on the way out.
 * The count is written after the redirect has gone, through waitUntil, and
 * a count that fails is nobody's problem.
 */

import {
  sessionUser, wrongDatabase, readCookie, openSession, sessionCookie,
  claimDeviceSaves, SESSION_DAYS, countsKey
} from './_lib.js';
import {
  googleReady, googleUser, linkIdentity, GOOGLE_PATH,
  FLOW_COOKIE, flowCookie,
  sealFlow, unseal, pkce, authorizeUrl, identify,
  APP_BACK, appChallenge, sealTicket
} from './_google.js';
import { makeGoogleAccount } from './_account.js';
import { adminIds } from './_admin.js';
import { countSignup } from './_visitors.js';
import { inAppOf } from './_visits.js';

/* One step of the round trip into the sign-up funnel, after the answer has
   gone — AND WHAT IT COUNTS. */
function tally(context, name) {
  context.waitUntil(countSignup(context.env, name).catch(() => false));
}

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

/* The same for a trip the iPhone app started: every ending is APP_BACK, which
   the system's sign-in sheet hands to the app that opened it, with the
   outcome said the way land() says it and a ticket where somebody signed in.
   THE APP'S WAY BACK IN in ./_google.js is the argument for the ticket.

   The flow cookie is cleared here too. The sheet shares the browser's
   cookies, so one left standing would be read by the next trip that browser
   starts on the site itself. */
function landApp(outcome, ticket, cookies) {
  const params = new URLSearchParams();
  if (outcome) params.set('google', outcome);
  if (ticket) params.set('ticket', ticket);
  const query = params.toString();

  const headers = new Headers({ location: APP_BACK + (query ? '?' + query : ''), 'cache-control': 'no-store' });
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

  /* The iPhone app's challenge, where the app is who is asking. See THE
     APP'S WAY BACK IN in ./_google.js. Anything that is not the shape of one
     is no challenge at all, and the trip is a browser's. */
  const app = appChallenge(url.searchParams.get('app'));

  /* Signed in already means this is a connect and not a sign-in, and that is
     settled here rather than on the way back. See the header. */
  /* Never for the app. Its sheet carries the browser's cookies, so somebody
     signed in to the site in Safari would otherwise have the Google account
     they pick in the app connected to that account — and the app, which is
     the one that asked, signed in to nothing. The app only ever signs in. */
  const user = app ? null : await sessionUser(request, env);

  const state = crypto.randomUUID();
  const nonce = crypto.randomUUID();
  const { verifier, challenge } = await pkce();

  const sealed = await sealFlow(env.SAVE_SALT, {
    state,
    nonce,
    verifier,
    then,
    client,
    app,
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

  if (!user) {
    tally(context, 'google_out');
    if (inAppOf(request.headers.get('user-agent'))) tally(context, 'google_out_inapp');
  }
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
  if (!flow) {
    tally(context, 'google_back_failed');
    return land(origin, '/', 'failed', [clear]);
  }

  const then = safePath(flow.then, origin);
  const signing = flow.intent !== 'link';

  /* Where every ending below goes: the page the trip started on, or the app
     that started it. One function, so no ending can pick the wrong one. */
  const app = appChallenge(flow.app);
  const end = (outcome) => (app ? landApp(outcome, '', [clear]) : land(origin, then, outcome, [clear]));

  /* Pressing Cancel on Google's screen. A decision, not a fault: back where
     they were, with nothing said about it. */
  if (failure === 'access_denied') {
    if (signing) tally(context, 'google_back_cancel');
    return end('');
  }
  if (failure || !code) {
    if (signing) tally(context, 'google_back_failed');
    return end('failed');
  }

  /* What the state parameter is for: this answer belongs to the trip this
     browser started, and not to one somebody else started in a link. */
  if (state !== flow.state) {
    if (signing) tally(context, 'google_back_failed');
    return end('failed');
  }

  const identity = await identify(env, {
    code,
    verifier: flow.verifier,
    nonce: flow.nonce,
    redirectUri: origin + GOOGLE_PATH
  });
  if (!identity) {
    if (signing) tally(context, 'google_back_failed');
    return end('failed');
  }

  if (!signing) return connect(context, origin, then, identity, clear);
  return signIn(context, origin, then, identity, flow.client, clear, app);
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

/* Signing in, and making the account first where there is none yet. */
async function signIn(context, origin, then, identity, client, clear, app) {
  const { request, env } = context;

  let userId = await googleUser(env, identity.subject);
  const made = !userId;

  /* Never been here: the account is made now, under a drawn name they can
     change on the account page — makeGoogleAccount() in ./_account.js says
     why it no longer asks. Ninety thousand names make a draw that finds none
     free all but impossible; were it to happen, it is a failed trip. */
  if (made) {
    userId = await makeGoogleAccount(env, identity.subject);
    if (!userId) {
      tally(context, 'google_back_failed');
      return app ? landApp('failed', '', [clear]) : land(origin, then, 'failed', [clear]);
    }
  } else {
    await env.DB.prepare('UPDATE users SET last_seen_at = ? WHERE id = ?').bind(Date.now(), userId).run();
  }

  /* The same claim a password sign-in makes: what this browser saved before
     anybody signed in moves onto the account, merged rather than doubled. */
  const touched = await claimDeviceSaves(env, userId, client);
  if (touched.length) context.waitUntil(caches.default.delete(countsKey(request)));

  /* The app is handed a ticket and no cookie: the sheet this answer goes to
     is not the app, and a session opened here would be one nobody holds. The
     session is opened when the app presents the ticket — `action: ticket` in
     ./account.js — and counted here, where the sign-in happened. */
  if (app) {
    if (made) tally(context, 'google_back_new');
    else if (!adminIds(env).has(String(userId).toLowerCase())) tally(context, 'google_back_in');
    const ticket = await sealTicket(env.SAVE_SALT, { userId, challenge: app });
    return landApp(made ? 'new' : 'in', ticket, [clear]);
  }

  const token = await openSession(env, userId);
  if (made) tally(context, 'google_back_new');
  else if (!adminIds(env).has(String(userId).toLowerCase())) tally(context, 'google_back_in');
  return land(origin, then, made ? 'new' : 'in', [clear, sessionCookie(token, SESSION_DAYS, request)]);
}
