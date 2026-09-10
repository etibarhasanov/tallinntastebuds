/**
 * Tallinn Tastebuds — accounts, so a list of saved places can follow a person.
 *
 * A username and a password, and nothing else. No email, no phone, no OAuth,
 * no profile, no name. The site collects the least it can while still being
 * able to say "these saves are yours" on a second device, and a username
 * somebody chose for themselves is as little as that can be.
 *
 * This route used to hand the sign-up sheet a name — two words and a number,
 * checked against the table so the one offered was free — rather than open on
 * an empty box. It read as thoughtful and was not: the name a person is known
 * by here is the byline on every list they share, and being given
 * `smoky-walnut-418` for it is the site naming somebody who was perfectly able
 * to name themselves. So the sheet asks, and the rule it has to keep is
 * printed under the field rather than only in the refusal after the button.
 *
 * THERE IS NO RESET, AND THAT IS THE TRADE
 *
 * Nothing proves an account is yours except knowing its password, so a
 * forgotten one is gone for good, for everybody including whoever runs the
 * site. The sign-up sheet says so before the button rather than letting
 * somebody find out later, and the fields carry the autocomplete hints that
 * make a browser's password manager offer to keep the details, which is what
 * actually rescues people in practice.
 *
 * There was a reset for a while, behind an optional address and a six-digit
 * code through Cloudflare's Email Service. It was never switched on — Email
 * Sending is not on the free plan — so every deployment this site has ever
 * had ran the paragraph above, with a few hundred lines underneath it that
 * only ever answered "not available". They are gone, and so are the two
 * columns and the table they wrote to; see **Accounts** in README.md.
 *
 * WHY AN ACCOUNT IS OPTIONAL
 *
 * Saving works with no account at all: the device keeps a random id and the
 * save is filed under that. Signing in claims those saves — the rows move
 * from the device to the account — so nobody is asked to sign up before they
 * have any reason to, and nothing anybody saved before signing in is lost.
 * See `claim` below for how the move is made and why it cannot double-count.
 *
 * WHAT IS STORED
 *
 *   users      a random id, the username, and a PBKDF2 hash of the password
 *              with its own salt and iteration count. Never the password.
 *   sessions   the SHA-256 of the session token, never the token. A leaked
 *              table is a list of hashes, not a drawer of working keys.
 *   login_fails a hashed network fingerprint and a timestamp, to slow down
 *              guessing, kept for as long as the window and no longer.
 */

import {
  json, clientIp, fingerprint, sha256Hex, randomHex, derivePassword, sameSecret,
  pwIterations, sessionCookie, sessionUser, SESSION_DAYS, SESSION_COOKIE,
  readCookie, wrongDatabase, RECOUNT_SQL, countsKey
} from './_lib.js';

/* Guessing is the only way in — there is no reset link to phish and no
   address to intercept — so it is the thing to make slow. Ten wrong passwords
   from one network fingerprint in fifteen minutes and that fingerprint
   waits. */
const MAX_FAILS = 10;
const FAIL_WINDOW = 15 * 60 * 1000;

/* Three to twenty-four, lowercase, and a letter or a digit to open with, so
   that a name cannot begin with the character that separates words in it. The
   sheet restates this as a line under the field and as `maxlength`, and
   `accountUsernameHint` and `accountErrUsername` in data/ui.json are the two
   sentences that say it in ten languages — change the pattern, change all
   four. */
const USERNAME_RE = /^[a-z0-9][a-z0-9-]{2,23}$/;
const MIN_PASSWORD = 8;

async function nameTaken(env, username) {
  const row = await env.DB
    .prepare('SELECT 1 AS x FROM users WHERE username = ? COLLATE NOCASE')
    .bind(username)
    .first();
  return !!row;
}

async function tooManyFails(env, hash) {
  const row = await env.DB
    .prepare('SELECT COUNT(*) AS n FROM login_fails WHERE ip_hash = ? AND at > ?')
    .bind(hash, Date.now() - FAIL_WINDOW)
    .first();
  return !!row && row.n >= MAX_FAILS;
}

async function noteFail(env, hash) {
  await env.DB.batch([
    env.DB.prepare('INSERT INTO login_fails (ip_hash, at) VALUES (?, ?)').bind(hash, Date.now()),
    /* Swept on the way past rather than by a scheduled job: rows outside the
       window can never affect an answer, so keeping them would be storing a
       record of somebody's failures for no reason at all. */
    env.DB.prepare('DELETE FROM login_fails WHERE at < ?').bind(Date.now() - FAIL_WINDOW)
  ]);
}

/* ------------------------------------------------------------------ claim
 * Move a device's saves onto an account.
 *
 * UPDATE OR IGNORE, then DELETE, and the order matters. A row that cannot
 * move — because the account already has that place, saved on another device
 * — is left alone by the update rather than failing the whole statement, and
 * the delete then clears it away. The effect is a merge: the union of what
 * the device had and what the account had, with nothing counted twice.
 *
 * Both places' counts are then recomputed from the rows, so a place that was
 * saved on two devices by one person who has now signed in on both drops from
 * two to one, which is the true number.
 */
async function claim(env, userId, clientId) {
  if (!clientId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(clientId)) {
    return [];
  }

  const { results } = await env.DB
    .prepare("SELECT place_id FROM saves WHERE owner = ? AND owner_kind = 'device'")
    .bind(clientId)
    .all();
  if (!results.length) return [];

  const touched = results.map((r) => r.place_id);

  const statements = [
    env.DB
      .prepare("UPDATE OR IGNORE saves SET owner = ?, owner_kind = 'user' WHERE owner = ? AND owner_kind = 'device'")
      .bind(userId, clientId),
    env.DB
      .prepare("DELETE FROM saves WHERE owner = ? AND owner_kind = 'device'")
      .bind(clientId)
  ];
  for (const place of touched) {
    statements.push(env.DB.prepare(RECOUNT_SQL).bind(place, place));
  }
  await env.DB.batch(statements);

  return touched;
}

/* The places this account has saved, so a fresh device can draw its marks
   filled the moment somebody signs in on it. */
async function savedByUser(env, userId) {
  const { results } = await env.DB
    .prepare('SELECT place_id FROM saves WHERE owner = ? ORDER BY created_at DESC')
    .bind(userId)
    .all();
  return results.map((r) => r.place_id);
}

/* ------------------------------------------------------------------- who
 * GET /api/account — who is signed in, and what they have saved.
 */
export async function onRequestGet(context) {
  const { request, env } = context;

  /* Whether accounts work at all here. The first two are set in the Pages
     project and neither has a sensible default: without the binding there is
     nowhere to put a user, and without the salt the sign-in route refuses to
     write. The third is the split — a deployment holding the other
     environment's database reports itself as not ready rather than offering a
     sign-up sheet that would write into the wrong one.

     This is reported rather than assumed because the client hides the whole
     account button unless it comes back true. A deploy that reaches the site
     before the bindings do would otherwise show a sign-up sheet that could
     only ever answer "something went wrong", which is worse than showing
     nothing at all. */
  const ready = !!(env.DB && env.SAVE_SALT) && !(await wrongDatabase(env));
  if (!ready) return json({ ready: false, user: null }, 200);

  const user = await sessionUser(request, env);
  if (!user) return json({ ready: true, user: null }, 200);

  return json({
    ready: true,
    user: user.username,
    saved: await savedByUser(env, user.id)
  }, 200);
}

/* ---------------------------------------------------------------- create,
 * sign in, sign out, change the password. One endpoint, because they share
 * every check: the same username and password rules, the same slow-down on a
 * fingerprint that keeps getting a password wrong, and the same session
 * table on the way in and out.
 */
export async function onRequestPost(context) {
  const { request, env } = context;

  if (!env.DB) return json({ error: 'no-database' }, 503);
  /* The wrong half of the split — see wrongDatabase(). An account made on a
     preview URL must not be an account on the live site, and the sign-in
     below must not read the live users table. */
  if (await wrongDatabase(env)) return json({ error: 'wrong-database' }, 503);
  if (!env.SAVE_SALT) return json({ error: 'no-salt' }, 503);

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return json({ error: 'malformed' }, 400);
  }

  const action = body.action;

  if (action === 'logout') {
    const token = readCookie(request, SESSION_COOKIE);
    if (token) {
      await env.DB
        .prepare('DELETE FROM sessions WHERE token_hash = ?')
        .bind(await sha256Hex(token))
        .run();
    }
    /* Two clears, and the second one is not a mistake. The session cookie is
       scoped to tallinntastebuds.ee so that the splitwise subdomain is signed
       in when the map is — see sessionCookie() in ./_lib.js — and a browser
       that signed in before it was may still be holding the host-only cookie
       this site set for years. Clearing only the domain-scoped one would
       leave that one standing and Sign out would appear to do nothing. On a
       preview host the two are the same string, and clearing a cookie twice
       costs nothing. */
    const gone = new Headers({
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store'
    });
    gone.append('set-cookie', sessionCookie('', 0, request));
    gone.append('set-cookie', sessionCookie('', 0, null));
    return new Response(JSON.stringify({ user: null }), { headers: gone });
  }

  /* ------------------------------------------------- changing a password
   * The one account change that needs the old password as well as the new
   * one: a sheet left open on a shared laptop must not be a way to take the
   * account off whoever owns it. The current password is checked the same
   * way a sign-in checks it, and a wrong one is counted against the same
   * fingerprint that slows guessing down everywhere else.
   *
   * Every session goes, and this browser is handed a fresh one. A password
   * is changed either because it was dull or because somebody else may have
   * it, and in the second case leaving the other devices signed in would be
   * changing the lock and posting the old key back through the door. The new
   * cookie is what keeps the person doing it from being thrown out of their
   * own account for their trouble.
   */
  if (action === 'password-change') {
    const user = await sessionUser(request, env);
    if (!user) return json({ error: 'signed-out' }, 401);

    const current = typeof body.current === 'string' ? body.current : '';
    const next = typeof body.password === 'string' ? body.password : '';
    if (next.length < MIN_PASSWORD) return json({ error: 'password' }, 400);

    const hash = await fingerprint(env.SAVE_SALT, clientIp(request), request.headers.get('User-Agent') || '');
    if (await tooManyFails(env, hash)) return json({ error: 'slow-down' }, 429);

    const row = await env.DB
      .prepare('SELECT pw_hash, pw_salt, pw_iter FROM users WHERE id = ?')
      .bind(user.id)
      .first();
    const ok = row && sameSecret(await derivePassword(current, row.pw_salt, row.pw_iter), row.pw_hash);
    if (!ok) {
      await noteFail(env, hash);
      /* Its own answer, and not the sign-in's "wrong username or password":
         the username is not in question here — this request came in on a
         session that already proves it — so saying so would be telling
         somebody who is signed in that they might have the wrong name. It
         gives nothing away that the session does not already carry. */
      return json({ error: 'current' }, 401);
    }
    /* Saying so rather than reporting a change that did not happen. */
    if (next === current) return json({ error: 'same' }, 400);

    const salt = randomHex(16);
    const iter = pwIterations(env);
    const token = randomHex(32);
    await env.DB.batch([
      env.DB
        .prepare('UPDATE users SET pw_hash = ?, pw_salt = ?, pw_iter = ? WHERE id = ?')
        .bind(await derivePassword(next, salt, iter), salt, iter, user.id),
      env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(user.id),
      env.DB
        .prepare('INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)')
        .bind(await sha256Hex(token), user.id, Date.now(), Date.now() + SESSION_DAYS * 86400000)
    ]);

    return new Response(JSON.stringify({ changed: true, user: user.username }), {
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'no-store',
        'set-cookie': sessionCookie(token, SESSION_DAYS, request)
      }
    });
  }

  if (action !== 'create' && action !== 'login') return json({ error: 'action' }, 400);

  const username = typeof body.username === 'string' ? body.username.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  const clientId = typeof body.client === 'string' ? body.client : '';

  if (!USERNAME_RE.test(username)) return json({ error: 'username' }, 400);
  if (password.length < MIN_PASSWORD) return json({ error: 'password' }, 400);

  const hash = await fingerprint(env.SAVE_SALT, clientIp(request), request.headers.get('User-Agent') || '');
  if (await tooManyFails(env, hash)) return json({ error: 'slow-down' }, 429);

  let userId;

  if (action === 'create') {
    if (await nameTaken(env, username)) return json({ error: 'taken' }, 409);

    userId = crypto.randomUUID();
    const salt = randomHex(16);
    const iter = pwIterations(env);
    await env.DB
      .prepare(
        'INSERT INTO users (id, username, pw_hash, pw_salt, pw_iter, created_at, last_seen_at) ' +
        'VALUES (?, ?, ?, ?, ?, ?, ?)'
      )
      .bind(
        userId,
        username,
        await derivePassword(password, salt, iter),
        salt,
        iter,
        Date.now(),
        Date.now()
      )
      .run();
  } else {
    const row = await env.DB
      .prepare('SELECT id, pw_hash, pw_salt, pw_iter FROM users WHERE username = ? COLLATE NOCASE')
      .bind(username)
      .first();

    /* One answer for "no such account" and for "wrong password", so the
       reply cannot be used to find out which usernames exist. */
    const ok = row && sameSecret(await derivePassword(password, row.pw_salt, row.pw_iter), row.pw_hash);
    if (!ok) {
      await noteFail(env, hash);
      return json({ error: 'no-match' }, 401);
    }
    userId = row.id;
    await env.DB
      .prepare('UPDATE users SET last_seen_at = ? WHERE id = ?')
      .bind(Date.now(), userId)
      .run();

    /* Raising PW_ITERATIONS should not strand the accounts made before it was
       raised, and the only moment the plaintext password is in hand to redo
       the work is this one — a successful sign-in. So a row behind the current
       setting is quietly brought up to it here, and nowhere else.

       Only upwards, and only when it is actually behind: lowering the setting
       must never quietly weaken hashes that are already stronger than it. */
    const want = pwIterations(env);
    if (row.pw_iter < want) {
      const fresh = randomHex(16);
      await env.DB
        .prepare('UPDATE users SET pw_hash = ?, pw_salt = ?, pw_iter = ? WHERE id = ?')
        .bind(await derivePassword(password, fresh, want), fresh, want, userId)
        .run();
    }
  }

  /* The token goes to the browser; only its hash is kept here. */
  const token = randomHex(32);
  await env.DB
    .prepare('INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)')
    .bind(await sha256Hex(token), userId, Date.now(), Date.now() + SESSION_DAYS * 86400000)
    .run();

  const touched = await claim(env, userId, clientId);
  /* Claiming can lower a count — a place one person had saved from two
     devices is one save now, not two — so the copy this colo is handing out
     may be wrong. */
  if (touched.length) context.waitUntil(caches.default.delete(countsKey(request)));

  return new Response(
    JSON.stringify({ user: username, saved: await savedByUser(env, userId) }),
    {
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'no-store',
        'set-cookie': sessionCookie(token, SESSION_DAYS, request)
      }
    }
  );
}
