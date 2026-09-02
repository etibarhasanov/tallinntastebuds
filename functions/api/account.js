/**
 * Tallinn Tastebuds — accounts, so a list of saved places can follow a person.
 *
 * A username and a password, and nothing else. No email, no phone, no OAuth,
 * no profile, no name. The site collects the least it can while still being
 * able to say "these saves are yours" on a second device, and a username the
 * visitor never chose and an address nobody asked for is as little as that
 * can be.
 *
 * AN EMAIL IS OPTIONAL, AND IT BUYS ONE THING
 *
 * Without one there is no reset: nothing proves an account is yours except
 * knowing its password, so a forgotten one is gone for good, for everybody
 * including whoever runs the site. Adding an address and confirming it with a
 * code is what makes a reset possible later, and it is the only thing the
 * address is ever used for — no list, no newsletter, no mail that is not a
 * six-digit code somebody just asked for.
 *
 * Nobody is made to give one. The sign-up sheet says what it is for and lets
 * you past without it, and the fields carry the autocomplete hints that make
 * a browser's password manager offer to keep the details, which is what
 * actually rescues people in practice.
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
  PW_ITERATIONS, sessionCookie, sessionUser, SESSION_DAYS, SESSION_COOKIE,
  readCookie, RECOUNT_SQL, countsKey
} from './_lib.js';

/* Guessing is the only way in — there is no reset link to phish and no email
   to intercept — so it is the thing to make slow. Ten wrong passwords from
   one network fingerprint in fifteen minutes and that fingerprint waits. */
const MAX_FAILS = 10;
const FAIL_WINDOW = 15 * 60 * 1000;

const USERNAME_RE = /^[a-z0-9][a-z0-9-]{2,23}$/;
const MIN_PASSWORD = 8;

/* Deliberately loose. The confirmation code is what actually establishes that
   an address is real and reachable, so a stricter pattern here would only
   turn away the unusual-but-valid ones. */
const EMAIL_RE = /^[^\s@]+@[^\s@.]+\.[^\s@]+$/;
const CODE_TTL = 15 * 60 * 1000;

/* Suggested usernames are built from these, so the name somebody is handed
   reads like the site rather than like a serial number. Two words and a
   number is enough for millions of combinations, and the check below is what
   actually guarantees the one offered is free. */
const ADJECTIVES = [
  'salty', 'sweet', 'smoky', 'crispy', 'golden', 'quiet', 'hungry', 'happy',
  'warm', 'bright', 'little', 'wild', 'soft', 'rich', 'fresh', 'bold'
];
const NOUNS = [
  'bakery', 'kitchen', 'pepper', 'coffee', 'noodle', 'pastry', 'tavern',
  'cherry', 'butter', 'lemon', 'basil', 'ginger', 'walnut', 'honey', 'olive'
];

function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function suggestName() {
  return pick(ADJECTIVES) + '-' + pick(NOUNS) + '-' + (100 + Math.floor(Math.random() * 900));
}

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
 * GET /api/account — who is signed in, and what they have saved. Also the
 * source of a suggested username for the sign-up sheet, which is checked
 * against the table so the one offered is one that will actually be free.
 */
export async function onRequestGet(context) {
  const { request, env } = context;

  /* Whether accounts work at all here. Both are set in the Pages project and
     neither has a sensible default: without the binding there is nowhere to
     put a user, and without the salt the sign-in route refuses to write.

     This is reported rather than assumed because the client hides the whole
     account button unless it comes back true. A deploy that reaches the site
     before the bindings do would otherwise show a sign-up sheet that could
     only ever answer "something went wrong", which is worse than showing
     nothing at all. */
  const ready = !!(env.DB && env.SAVE_SALT);
  if (!ready) return json({ ready: false, user: null, email: false }, 200);

  const url = new URL(request.url);
  if (url.searchParams.get('suggest')) {
    let name = suggestName();
    for (let tries = 0; tries < 5 && (await nameTaken(env, name)); tries++) name = suggestName();
    return json({ suggest: name }, 200);
  }

  const user = await sessionUser(request, env);
  if (!user) return json({ ready: true, user: null, email: emailReady(env) }, 200);

  const row = await env.DB
    .prepare('SELECT email, email_verified FROM users WHERE id = ?')
    .bind(user.id)
    .first();

  return json({
    ready: true,
    user: user.username,
    saved: await savedByUser(env, user.id),
    /* Whether an address is on the account, and whether the site can send to
       one at all — the sheet needs both to know what to offer. */
    recovery: !!(row && row.email && row.email_verified),
    email: emailReady(env)
  }, 200);
}

/* ---------------------------------------------------------------- create,
 * sign in, sign out. One endpoint, because they share every check.
 */
export async function onRequestPost(context) {
  const { request, env } = context;

  if (!env.DB) return json({ error: 'no-database' }, 503);
  if (!env.SAVE_SALT) return json({ error: 'no-salt' }, 503);

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return json({ error: 'malformed' }, 400);
  }

  const action = body.action;

  if (action === 'email-add' || action === 'email-confirm' ||
      action === 'recover-start' || action === 'recover-finish') {
    const hash = await fingerprint(
      env.SAVE_SALT, clientIp(request), request.headers.get('User-Agent') || ''
    );
    return handleEmail(context, body, hash);
  }

  if (action === 'logout') {
    const token = readCookie(request, SESSION_COOKIE);
    if (token) {
      await env.DB
        .prepare('DELETE FROM sessions WHERE token_hash = ?')
        .bind(await sha256Hex(token))
        .run();
    }
    return new Response(JSON.stringify({ user: null }), {
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'no-store',
        'set-cookie': sessionCookie('', 0)
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
    await env.DB
      .prepare(
        'INSERT INTO users (id, username, pw_hash, pw_salt, pw_iter, created_at, last_seen_at) ' +
        'VALUES (?, ?, ?, ?, ?, ?, ?)'
      )
      .bind(
        userId,
        username,
        await derivePassword(password, salt, PW_ITERATIONS),
        salt,
        PW_ITERATIONS,
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
  }

  /* The token goes to the browser; only its hash is kept here. */
  const token = randomHex(32);
  await env.DB
    .prepare('INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)')
    .bind(await sha256Hex(token), userId, Date.now(), Date.now() + SESSION_DAYS * 86400000)
    .run();

  /* An address given on the sign-up sheet is stored but not trusted: it is
     written unverified and a code goes out, so recovery only starts working
     once somebody has proved they can read the inbox. Failing to send does
     not fail the sign-up — the account is already made, and the address can
     be confirmed later from the account sheet. */
  const offered = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  if (action === 'create' && offered && EMAIL_RE.test(offered) && emailReady(env)) {
    try {
      const code = await issueCode(env, userId, offered, 'verify');
      context.waitUntil(sendCode(env, offered, code, 'verify'));
    } catch (e) { /* an address is a convenience, never a blocker */ }
  }

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
        'set-cookie': sessionCookie(token, SESSION_DAYS)
      }
    }
  );
}

/* ------------------------------------------------------------------ email
 * Optional throughout, and switched off entirely until an email provider is
 * configured — the same shape Turnstile has. With no RESEND_API_KEY set the
 * routes below answer "not available" and every other part of the account
 * system carries on exactly as it did.
 */

function emailReady(env) {
  return !!(env.RESEND_API_KEY && env.MAIL_FROM);
}

async function sendCode(env, to, code, purpose) {
  const subject = purpose === 'recover'
    ? 'Your Tallinn Tastebuds reset code'
    : 'Confirm your email for Tallinn Tastebuds';
  const line = purpose === 'recover'
    ? 'Somebody asked to reset the password on your Tallinn Tastebuds account.'
    : 'Somebody added this address to a Tallinn Tastebuds account.';

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      authorization: 'Bearer ' + env.RESEND_API_KEY,
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      from: env.MAIL_FROM,
      to: [to],
      subject: subject,
      text: line + '\n\nYour code is ' + code +
            '\n\nIt is good for 15 minutes and can be used once. ' +
            'If this was not you, ignore this message — nothing has changed.'
    })
  });
  return res.ok;
}

/* Six digits, from real entropy rather than Math.random, and only the hash of
   it is kept: the codes table is then useless to anybody who reads it. Any
   code still outstanding for the same person and purpose is dropped first, so
   asking again always invalidates the last one. */
async function issueCode(env, userId, email, purpose) {
  const bytes = new Uint32Array(1);
  crypto.getRandomValues(bytes);
  const code = String(bytes[0] % 1000000).padStart(6, '0');

  await env.DB.batch([
    env.DB.prepare('DELETE FROM email_codes WHERE user_id = ? AND purpose = ?').bind(userId, purpose),
    env.DB.prepare('DELETE FROM email_codes WHERE expires_at < ?').bind(Date.now()),
    env.DB
      .prepare(
        'INSERT INTO email_codes (code_hash, user_id, email, purpose, created_at, expires_at) ' +
        'VALUES (?, ?, ?, ?, ?, ?)'
      )
      .bind(await sha256Hex(code), userId, email, purpose, Date.now(), Date.now() + CODE_TTL)
  ]);
  return code;
}

async function takeCode(env, code, purpose) {
  if (!/^[0-9]{6}$/.test(code || '')) return null;
  const hash = await sha256Hex(code);
  const row = await env.DB
    .prepare('SELECT user_id, email, expires_at FROM email_codes WHERE code_hash = ? AND purpose = ?')
    .bind(hash, purpose)
    .first();
  if (!row || row.expires_at < Date.now()) return null;
  /* Single use: spent on the way out, whatever the caller does next. */
  await env.DB.prepare('DELETE FROM email_codes WHERE code_hash = ?').bind(hash).run();
  return { userId: row.user_id, email: row.email };
}

export async function handleEmail(context, body, hash) {
  const { request, env } = context;
  const action = body.action;

  if (!emailReady(env)) return json({ error: 'no-email' }, 503);

  /* -------- adding an address to the account you are signed in to -------- */
  if (action === 'email-add') {
    const user = await sessionUser(request, env);
    if (!user) return json({ error: 'signed-out' }, 401);

    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    if (!EMAIL_RE.test(email)) return json({ error: 'email' }, 400);
    if (await tooManyFails(env, hash)) return json({ error: 'slow-down' }, 429);

    const code = await issueCode(env, user.id, email, 'verify');
    if (!(await sendCode(env, email, code, 'verify'))) return json({ error: 'send-failed' }, 502);
    return json({ sent: true }, 200);
  }

  if (action === 'email-confirm') {
    const user = await sessionUser(request, env);
    if (!user) return json({ error: 'signed-out' }, 401);
    if (await tooManyFails(env, hash)) return json({ error: 'slow-down' }, 429);

    const taken = await takeCode(env, body.code, 'verify');
    if (!taken || taken.userId !== user.id) {
      await noteFail(env, hash);
      return json({ error: 'bad-code' }, 400);
    }
    /* Somebody else may have claimed the address between the code going out
       and it coming back, and the unique index is what settles it. */
    try {
      await env.DB
        .prepare('UPDATE users SET email = ?, email_verified = 1 WHERE id = ?')
        .bind(taken.email, user.id)
        .run();
    } catch (e) {
      return json({ error: 'email-taken' }, 409);
    }
    return json({ email: taken.email, verified: true }, 200);
  }

  /* ----------------------------- resetting ------------------------------ */
  if (action === 'recover-start') {
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    if (!EMAIL_RE.test(email)) return json({ error: 'email' }, 400);
    if (await tooManyFails(env, hash)) return json({ error: 'slow-down' }, 429);

    const row = await env.DB
      .prepare('SELECT id FROM users WHERE email = ? COLLATE NOCASE AND email_verified = 1')
      .bind(email)
      .first();

    /* The same answer whether or not that address is on an account. Anything
       else turns this endpoint into a way of asking who has registered. */
    if (row) {
      const code = await issueCode(env, row.id, email, 'recover');
      context.waitUntil(sendCode(env, email, code, 'recover'));
    }
    return json({ sent: true }, 200);
  }

  if (action === 'recover-finish') {
    const password = typeof body.password === 'string' ? body.password : '';
    if (password.length < MIN_PASSWORD) return json({ error: 'password' }, 400);
    if (await tooManyFails(env, hash)) return json({ error: 'slow-down' }, 429);

    const taken = await takeCode(env, body.code, 'recover');
    if (!taken) {
      await noteFail(env, hash);
      return json({ error: 'bad-code' }, 400);
    }

    const salt = randomHex(16);
    await env.DB.batch([
      env.DB
        .prepare('UPDATE users SET pw_hash = ?, pw_salt = ?, pw_iter = ? WHERE id = ?')
        .bind(await derivePassword(password, salt, PW_ITERATIONS), salt, PW_ITERATIONS, taken.userId),
      /* Every session goes. A reset is the one moment where somebody may be
         doing this precisely because a session they do not control exists. */
      env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(taken.userId)
    ]);

    const who = await env.DB.prepare('SELECT username FROM users WHERE id = ?').bind(taken.userId).first();
    return json({ reset: true, user: who ? who.username : null }, 200);
  }

  return json({ error: 'action' }, 400);
}
