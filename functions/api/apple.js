/**
 * Tallinn Tastebuds — /api/apple, Sign in with Apple from the iPhone app.
 *
 * One POST and no trip: the app shows Apple's own sheet, Apple hands it a
 * signed token, and the app sends that here with the nonce it asked for it
 * under. ./_apple.js is the check, and says why it is a different shape from
 * Google's.
 *
 *   POST { token, nonce }
 *
 *   200 { user, saved }   signed in, the session cookie set — the answer a
 *                         password sign-in gets from ./account.js, so the app
 *                         reads the two with one piece of code. An Apple
 *                         account that has never been here has an account
 *                         made for it under a drawn name, the way a Google
 *                         one does: makeIdentityAccount() in ./_account.js.
 *   401 { error: apple }  the token did not check out
 *
 * THERE IS NO BUTTON FOR THIS ON THE SITE
 *
 * A browser cannot produce the token this route reads: it is signed for the
 * app's bundle id, and a web sign-in with Apple is signed for a Services ID
 * and is a different integration with a secret of its own. An account made
 * here is reached from the site by setting a password on it in the app's
 * session — or by connecting Google from the account page — and until then
 * it has the one way in.
 *
 * NOT COUNTED YET
 *
 * The steps of signing up in ./_visitors.js are a browser's — a sheet opened,
 * a trip to Google and back — and their names are a closed set that the
 * owner's pages draw. An account made here is in `users` and in nobody's
 * funnel. Counting the app's sign-ins is its own piece of work, with its own
 * names, rather than one more thing filed under `google:`.
 *
 * AND NO SLOW-DOWN
 *
 * The fingerprint counter in ./_account.js exists because a password can be
 * guessed. There is nothing here to guess: a token is Apple's signature or it
 * is not, and a wrong one costs this Worker a hash and, at most, one cached
 * read of Apple's keys.
 */

import { json, wrongDatabase, openSession, sessionCookie, SESSION_DAYS } from './_lib.js';
import { APPLE, appleSubject } from './_apple.js';
import { identityUser } from './_google.js';
import { makeIdentityAccount } from './_account.js';

export async function onRequestPost(context) {
  const { request, env } = context;

  if (!env.DB) return json({ error: 'no-database' }, 503);
  if (await wrongDatabase(env)) return json({ error: 'wrong-database' }, 503);
  if (!env.SAVE_SALT) return json({ error: 'no-salt' }, 503);

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return json({ error: 'malformed' }, 400);
  }

  const subject = await appleSubject(env, body && body.token, body && body.nonce);
  if (!subject) return json({ error: 'apple' }, 401);

  let userId = await identityUser(env, APPLE, subject);
  const made = !userId;
  if (made) {
    userId = await makeIdentityAccount(env, APPLE, subject);
    if (!userId) return json({ error: 'apple' }, 500);
  } else {
    await env.DB.prepare('UPDATE users SET last_seen_at = ? WHERE id = ?').bind(Date.now(), userId).run();
  }

  const row = await env.DB.prepare('SELECT username FROM users WHERE id = ?').bind(userId).first();
  if (!row) return json({ error: 'apple' }, 500);

  const { results } = await env.DB
    .prepare('SELECT place_id FROM saves WHERE owner = ? ORDER BY created_at DESC')
    .bind(userId)
    .all();

  const token = await openSession(env, userId);
  return new Response(
    JSON.stringify({ user: row.username, saved: results.map((r) => r.place_id) }),
    {
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'no-store',
        'set-cookie': sessionCookie(token, SESSION_DAYS, request)
      }
    }
  );
}
