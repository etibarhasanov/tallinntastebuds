/**
 * Tallinn Tastebuds — the account rules, and the one step that makes or
 * enters an account.
 *
 * Underscore-prefixed files under functions/ are not routed, so this is a
 * module and never an endpoint — the same arrangement ./_google.js has beside
 * the route it serves.
 *
 * WHY THIS IS NOT ALL STILL IN ./account.js
 *
 * It was, and one route needed it. Two do now: /api/feedback lets somebody
 * put their name on what they wrote without going to the map first, so the
 * username rule, the password floor, the thirty-day hold on a released name,
 * the slow-down on a fingerprint that keeps guessing and the PBKDF2 compare
 * are all asked for in two places. Two copies of a sign-in is the kind of
 * duplication that goes wrong quietly: the day one of them stops counting a
 * failed attempt, the other is still the door everybody is looking at.
 *
 * So the rules live here and the routes read them. Nothing in this file
 * answers a request or sets a cookie — `enterAccount` hands back a token and
 * the caller decides what a successful sign-in looks like on its own page,
 * because the map's sheet and the feedback composer say different things
 * afterwards.
 */

import {
  clientIp, fingerprint, randomHex, derivePassword, sameSecret, pwIterations,
  openSession, claimDeviceSaves, countsKey
} from './_lib.js';

/* Guessing is the only way in — there is no reset link to phish and no
   address to intercept — so it is the thing to make slow. Ten wrong passwords
   from one network fingerprint in fifteen minutes and that fingerprint
   waits. */
const MAX_FAILS = 10;
const FAIL_WINDOW = 15 * 60 * 1000;

/* Three to twenty-four, lowercase, and a letter or a digit to open with, so
   that a name cannot begin with the character that separates words in it.
   Every sheet that asks for a name restates this as a line under the field
   and as `maxlength`, and `accountUsernameHint` and `accountErrUsername` in
   data/ui.json are the two sentences that say it in ten languages — change
   the pattern, change all of them. `grep -n maxlength assets/*.js` finds the
   fields. */
export const USERNAME_RE = /^[a-z0-9][a-z0-9-]{2,23}$/;
export const MIN_PASSWORD = 8;

/* How long a name stays with the account that just left it. A username is
   the byline on somebody's lists and the whole of /u/<name>, so a name put
   straight back in the pool is every link to that person handed to whoever
   signs up next. Thirty days is long enough for a rename to be regretted and
   undone, and short enough that a name somebody has actually finished with
   comes back. */
export const HOLD_DAYS = 30;

/* Whether a released name is still being held for somebody. `mine` is the
   account asking — a users.id when somebody signed in is renaming, and
   nothing at all where a stranger is taking a name. Your own hold never
   counts, which is how a rename regretted the same afternoon is undone by
   renaming back. */
export async function nameHeld(env, username, mine) {
  const held = await env.DB
    .prepare('SELECT user_id FROM username_holds WHERE username = ? COLLATE NOCASE AND released_at > ?')
    .bind(username, Date.now() - HOLD_DAYS * 86400000)
    .first();
  return !!held && held.user_id !== mine;
}

/* Whether a name is somebody else's, which is two questions and not one: who
   has it now, and who has just given it up. */
export async function nameTaken(env, username, mine) {
  const row = await env.DB
    .prepare('SELECT 1 AS x FROM users WHERE username = ? COLLATE NOCASE')
    .bind(username)
    .first();
  if (row) return true;
  return nameHeld(env, username, mine);
}

export async function tooManyFails(env, hash) {
  const row = await env.DB
    .prepare('SELECT COUNT(*) AS n FROM login_fails WHERE ip_hash = ? AND at > ?')
    .bind(hash, Date.now() - FAIL_WINDOW)
    .first();
  return !!row && row.n >= MAX_FAILS;
}

export async function noteFail(env, hash) {
  await env.DB.batch([
    env.DB.prepare('INSERT INTO login_fails (ip_hash, at) VALUES (?, ?)').bind(hash, Date.now()),
    /* Swept on the way past rather than by a scheduled job: rows outside the
       window can never affect an answer, so keeping them would be storing a
       record of somebody's failures for no reason at all. */
    env.DB.prepare('DELETE FROM login_fails WHERE at < ?').bind(Date.now() - FAIL_WINDOW)
  ]);
}

/* The password on an account, or the absence of one, in the shape `matches`
   wants. An account made through Google has an empty hash, and reading it as
   `{ hash: '', salt: '', iter: 0 }` is what lets `matches` be the one place
   that knows what an empty hash means. */
export async function passwordOn(env, userId) {
  const row = await env.DB
    .prepare('SELECT pw_hash, pw_salt, pw_iter FROM users WHERE id = ?')
    .bind(userId)
    .first();
  return {
    hash: (row && row.pw_hash) || '',
    salt: (row && row.pw_salt) || '',
    iter: (row && row.pw_iter) || 0
  };
}

/* Whether a password somebody typed is the one on the account.
 *
 * The empty hash is refused here and not at the call sites, and that is the
 * whole reason this is a function. An account made through Google has no
 * password, and `derivePassword(anything, '', 0)` is PBKDF2 at nought
 * iterations — which WebCrypto refuses outright, so the sign-in would answer
 * 500 instead of "wrong username or password" and would say, to anybody
 * asking, exactly which accounts were made through Google. */
export async function matches(pw, given) {
  if (!pw.hash) return false;
  return sameSecret(await derivePassword(given, pw.salt, pw.iter), pw.hash);
}

/* The network fingerprint a failed attempt is counted against. One-way and
   salted out of the Pages environment, so the raw address never lands in a
   table — see fingerprint() in ./_lib.js. */
export function failHash(env, request) {
  return fingerprint(env.SAVE_SALT, clientIp(request), request.headers.get('User-Agent') || '');
}

/* --------------------------------------------------- making or entering one
 * A username and a password in, a session out. Three doors ask for exactly
 * this and the only thing they disagree about is what a name that already
 * exists means, which is `mode`:
 *
 *   'create'  the sign-up sheet. A name somebody has is refused — telling
 *             them it is taken is the whole job of that form.
 *   'login'   the sign-in sheet. A name nobody has is refused, with the same
 *             answer a wrong password gets, so the reply cannot be used to
 *             find out which usernames exist.
 *   'either'  the feedback composer, where there is no sheet and no second
 *             step: a name nobody has makes an account, and one that exists
 *             signs you into it. The field says so under itself.
 *
 * `either` gives nothing away that the site does not already tell anybody:
 * the sign-up sheet answers "is this name free" to a stranger with no session
 * at all, which is the same question, asked more politely.
 *
 * Out comes { ok: true, userId, username, made, token, claimed } or
 * { ok: false, error, status }. The caller writes the cookie, because a
 * cookie is part of an answer and this file does not build answers.
 */
export async function enterAccount(context, opts) {
  const { request, env } = context;

  const username = typeof opts.username === 'string' ? opts.username.trim().toLowerCase() : '';
  const password = typeof opts.password === 'string' ? opts.password : '';
  const client = typeof opts.client === 'string' ? opts.client : '';
  const mode = opts.mode || 'either';

  if (!USERNAME_RE.test(username)) return { ok: false, error: 'username', status: 400 };
  if (password.length < MIN_PASSWORD) return { ok: false, error: 'password', status: 400 };

  const hash = await failHash(env, request);
  if (await tooManyFails(env, hash)) return { ok: false, error: 'slow-down', status: 429 };

  /* One read answers both branches: whether the name is anybody's, and the
     hash to check against if it is. The hold below is only asked about a name
     no account holds, which is the only case it can decide. */
  const row = await env.DB
    .prepare('SELECT id, pw_hash, pw_salt, pw_iter FROM users WHERE username = ? COLLATE NOCASE')
    .bind(username)
    .first();

  let userId;
  let made = false;

  if (row) {
    if (mode === 'create') return { ok: false, error: 'taken', status: 409 };

    /* One answer for "wrong password" and for "that account has no password
       because it was made through Google", so the reply cannot be used to
       find out which of the accounts that exist are reached some other way.
       matches() is where the second of those is decided. */
    const ok = await matches(
      { hash: row.pw_hash, salt: row.pw_salt, iter: row.pw_iter }, password
    );
    if (!ok) {
      await noteFail(env, hash);
      return { ok: false, error: 'no-match', status: 401 };
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
  } else {
    /* The sign-in sheet says no such account in the same words a wrong
       password gets, for the reason above. */
    if (mode === 'login') {
      await noteFail(env, hash);
      return { ok: false, error: 'no-match', status: 401 };
    }

    /* No account asking, so every hold counts: a name somebody walked away
       from last week is not a name a stranger may sign up as, or every link
       to that person would now point at whoever got there first. */
    if (await nameHeld(env, username)) return { ok: false, error: 'taken', status: 409 };

    userId = crypto.randomUUID();
    made = true;
    const salt = randomHex(16);
    const iter = pwIterations(env);
    try {
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
    } catch (e) {
      /* Two people taking the same free name in the same second. The unique
         index on users.username is what actually decides it, and the loser is
         told what the check above would have told them a moment earlier. */
      return { ok: false, error: 'taken', status: 409 };
    }
  }

  const token = await openSession(env, userId);

  /* Whatever this browser saved before it was anybody. Claiming can lower a
     count — a place one person had saved from two devices is one save now,
     not two — so a caller that touched anything purges the counts cache. */
  const claimed = await claimDeviceSaves(env, userId, client);
  if (claimed.length) context.waitUntil(caches.default.delete(countsKey(request)));

  return { ok: true, userId: userId, username: username, made: made, token: token, claimed: claimed };
}
