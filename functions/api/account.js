/**
 * Tallinn Tastebuds — accounts, so a list of saved places can follow a person.
 *
 * A username, and either a password or a Google account. No email, no phone,
 * no real name. The site collects the least it can while still being able to
 * say "these saves are yours" on a second device, and a username somebody
 * chose for themselves is as little as that can be — signing in through
 * Google does not change that, because the only thing kept of it is an opaque
 * id. See ./_google.js, which asks Google for `openid` and nothing else.
 *
 * This route used to hand the sign-up sheet a name — two words and a number,
 * checked against the table so the one offered was free — rather than open on
 * an empty box. It read as thoughtful and was not: the name a person is known
 * by here is the byline on every list they share, and being given
 * `smoky-walnut-418` for it is the site naming somebody who was perfectly able
 * to name themselves. So the sheet asks, and the rule it has to keep is
 * printed under the field rather than only in the refusal after the button.
 *
 * TWO WAYS IN, AND THE SECOND ONE NEEDS NOTHING SENT
 *
 * A username and a password is one. Continue with Google is the other, and it
 * is here for the reason the password reset below is not: a reset has to
 * *send* something, and Email Sending is not on the free plan. Google sends
 * nothing — the browser goes there, the person signs in there, and what comes
 * back is a statement this site checks. ./google.js and ./_google.js are the
 * whole of that; by the time anything reaches this file a subject has already
 * proved itself.
 *
 * An account may have either way in, or both, and the guards below are what
 * make one with a single way in work properly rather than half-work: a
 * sign-in against an account with no password is refused outright, and the
 * two steps that ask for the password in use do not ask an account that has
 * not got one.
 *
 * THERE IS NO RESET FOR A PASSWORD, AND THAT IS THE TRADE
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
 * See claimDeviceSaves() in ./_lib.js for how the move is made and why it
 * cannot double-count.
 *
 * WHAT IS STORED
 *
 *   users      a random id, the username, a PBKDF2 hash of the password with
 *              its own salt and iteration count, and the line somebody wrote
 *              about themselves. Never the password. An account made through
 *              Google has no password at all and carries an empty hash — see
 *              the guard in `login` below, which refuses one rather than
 *              deriving a hash at nought iterations.
 *   identities which Google account, if any, this one is also reached
 *              through: Google's own permanent id for that person and
 *              nothing else. No address, no name, no picture. See
 *              ./_google.js.
 *   sessions   the SHA-256 of the session token, never the token. A leaked
 *              table is a list of hashes, not a drawer of working keys.
 *   login_fails a hashed network fingerprint and a timestamp, to slow down
 *              guessing, kept for as long as the window and no longer.
 *   username_holds the name an account used to go by, for thirty days after
 *              it changed, so a rename cannot hand somebody else's links to
 *              a stranger. See `username-change` below.
 */

import {
  json, sha256Hex, randomHex, derivePassword, pwIterations, sessionCookie,
  sessionUser, SESSION_DAYS, SESSION_COOKIE, readCookie, wrongDatabase
} from './_lib.js';
import {
  USERNAME_RE, MIN_PASSWORD, HOLD_DAYS,
  nameTaken, tooManyFails, noteFail, passwordOn, matches, failHash,
  enterAccount, nameGoogleAccount
} from './_account.js';
import { googleReady, unlinkGoogle, hasGoogle, pendingCookie } from './_google.js';
import { NETWORKS, cleanHandle, readLinks, readingExtras, cleanRows, readRows } from './_profile.js';

/* The line somebody writes about themselves on /u/<name>. The same length as
   a list's intro in functions/api/lists.js, and the same reasoning: it is a
   line under a title rather than a page, and a profile opening with six
   paragraphs about somebody stops being a page about their lists. Restated as
   a maxlength in assets/account.js, the way every cap here is. */
const MAX_ABOUT = 200;
/* The name somebody goes by, over the username: the heading of a profile
   that is a page. A list's title's cap, because it is a heading, and restated
   as a maxlength in assets/account.js the same way. */
const MAX_DISPLAY = 60;

/* The places this account has saved, so a fresh device can draw its marks
   filled the moment somebody signs in on it. It stays here rather than going
   into ./_account.js with the rest: this is the one thing in the answer that
   is about the map, and the feedback page has no use for it. */
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

  /* Whether Continue with Google can be offered here at all, which is its own
     question and not a part of `ready`: accounts work perfectly well on a
     deployment with no Google client set, and the sheet draws the button only
     where this says it would lead somewhere. Same argument as `ready` itself,
     one level in. */
  const google = googleReady(env);

  const user = await sessionUser(request, env);
  if (!user) return json({ ready: true, google: google, user: null }, 200);

  /* Whether there is a password on this account, which is what the two steps
     on the map's sheet read to decide whether to ask for the one in use.
     Unguarded, unlike the two reads below it: `users.pw_hash` has been there
     since the first account, so a failure here is a database that is broken
     rather than one that is merely behind, and reporting "no password" for an
     account that has one would quietly stop the sheet asking for it. */
  const pw = await passwordOn(env, user.id);

  /* Read here rather than added to sessionUser(), which every signed-in
     request on this site goes through — saves, lists and splitwise included,
     and not one of them prints this. One indexed read on the id already in
     hand, on the one page that draws the box it fills.

     Guarded, because `about` and `links` are columns that arrive by hand:
     db/schema.sql is applied by a person and a deployment can reach the site
     before they have run it. A line somebody wrote about themselves and the
     three handles beside it are the smallest things on this page and they
     must not be able to take it down — without the guard, an account page on
     a database that predates either column answers 500 and somebody's saves
     and lists go with it. readingExtras() in ./_profile.js is that guard and
     is shared with the profile, so the two pages cannot disagree about which
     columns this database has. Same bargain _lists.js takes over an
     unreadable catalogue: the missing piece costs itself and nothing around
     it. */
  let about;
  let links;
  let display;
  const extra = await readingExtras(env, (extras) => extras
    ? env.DB.prepare('SELECT ' + extras + ' FROM users WHERE id = ?').bind(user.id).first()
    : null);
  if (extra) {
    about = extra.about || undefined;
    /* Only where the column is actually there. readingExtras() may have
       settled on `about` alone, in which case this row has no links field and
       an empty object is the true answer — there are no handles in a database
       that has nowhere to keep them. */
    const some = readLinks(extra.links);
    links = Object.keys(some).length ? some : undefined;
    /* Only where that column is there too, for the same reason. */
    display = extra.display_name || undefined;
  }

  /* Whether Google is connected, which is what the account page draws its
     Google row from — Connect or Disconnect.

     GUARDED, AND THE `about` LINE ABOVE IS WHY THIS IS NOT AN OVERSIGHT
 *
     `identities` is a table that arrives by hand: db/schema.sql is applied by
     a person, and a deployment reaches the site the minute it is pushed. The
     window between those two is real — it is the ordinary state of the live
     site for as long as it takes somebody to run two commands — and this read
     runs on every signed-in request to this route. Unguarded, it takes the
     whole answer down for the length of that window: no name on the rail, no
     saves, no lists, an account page that says accounts are switched off.
 *
     False is the true answer while there is no table, because there are no
     identities in a database that has none. The cost of being wrong is a row
     on the account page reading Connect instead of Disconnect, and it cannot
     be wrong in the direction that matters: `hasGoogle` is never what decides
     whether a sign-in is allowed. Same bargain as `about` above, and as
     _lists.js over an unreadable catalogue — the missing piece costs itself
     and nothing around it. */
  let linked = false;
  try {
    linked = await hasGoogle(env, user.id);
  } catch (e) { /* no table yet: nothing is connected, and the page stands */ }

  return json({
    ready: true,
    google: google,
    user: user.username,
    linked: linked,
    /* Whether there is a password on this account at all. An account made
       through Google has none until somebody sets one. */
    password: !!pw.hash,
    about: about,
    /* The name they go by, for the box that writes it. */
    display: display,
    /* Handles, not addresses — the page builds the URL out of the same table
       the server validates against. Left out entirely where there are none,
       which is nearly every account. */
    links: links,
    /* The page of links under the profile, in its order, for the form that
       rewrites it. Guarded inside readRows() for the reason the two above
       are: the table arrives by hand, and until it has, an account has no
       rows rather than no account page. */
    rows: await readRows(env, user.id),
    saved: await savedByUser(env, user.id)
  }, 200);
}

/* ---------------------------------------------------------------- create,
 * sign in, sign out, change the password, change the username, write the line
 * about yourself, the name you go by, say where else you are, put together
 * your page of links.
 * One endpoint, because they share every check: the same
 * username and password rules, the same slow-down on a fingerprint that keeps
 * getting a password wrong, and the same session table on the way in and out.
 *
 * The two changes each check the password in use, against the same
 * fingerprint. That was two copies of a SELECT and a compare with a note
 * saying a third would be the moment to write a helper; signing in through
 * Google is the third, so `passwordOn` and `matches` above are it — and
 * `matches` is also the one place that knows an account can have no password
 * at all.
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

    const hash = await failHash(env, request);
    if (await tooManyFails(env, hash)) return json({ error: 'slow-down' }, 429);

    const pw = await passwordOn(env, user.id);

    /* AN ACCOUNT WITH NO PASSWORD IS SETTING ITS FIRST ONE
     *
     * Somebody who signed up through Google has nothing to type into a
     * "current password" box, so this step does not ask for one — there is
     * no secret to prove and the session is the only proof that exists. The
     * sheet draws one field instead of two and calls it Set a password.
     *
     * And it does not turn the other devices out. A change signs every other
     * session off because a password gets changed when somebody else may
     * have it; a first password is an account gaining a way in that nobody
     * has ever had, including whoever it is being taken from. Signing a
     * phone out for that would be a punishment for adding a lock. */
    const setting = !pw.hash;

    if (!setting) {
      if (!(await matches(pw, current))) {
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
    }

    const salt = randomHex(16);
    const iter = pwIterations(env);
    const statements = [
      env.DB
        .prepare('UPDATE users SET pw_hash = ?, pw_salt = ?, pw_iter = ? WHERE id = ?')
        .bind(await derivePassword(next, salt, iter), salt, iter, user.id)
    ];

    /* Setting a first password touches no session at all — not the other
       devices, which stay, and not this one, which is still perfectly good.
       So there is nothing to re-issue and no cookie on the way back.

       A change is the other case and needs both statements, in this order and
       in one batch: the delete takes every session on the account including
       the one that asked, so the insert has to land with it or somebody is
       signed out of their own browser for changing their password. That is
       also why this does not go through openSession() — a second round trip
       between the two is the gap. */
    let token = '';
    if (!setting) {
      token = randomHex(32);
      statements.push(
        env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(user.id),
        env.DB
          .prepare('INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)')
          .bind(await sha256Hex(token), user.id, Date.now(), Date.now() + SESSION_DAYS * 86400000)
      );
    }
    await env.DB.batch(statements);

    const done = new Headers({
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store'
    });
    if (token) done.append('set-cookie', sessionCookie(token, SESSION_DAYS, request));
    return new Response(JSON.stringify({ changed: true, user: user.username }), { headers: done });
  }

  /* ------------------------------------------------- changing a username
   * The one thing on an account that is a choice, and it has to be made
   * before somebody has seen a single list — the sign-up sheet asks for it
   * on the way past a bakery they wanted to save. So it is a choice worth
   * being able to make again. Nothing else moves — the saves,
   * the lists, the keeps and every splitwise group are filed under
   * `users.id`, which no rename touches — so this is one UPDATE and a row
   * saying what the account used to be called.
   *
   * WHY IT ASKS FOR THE PASSWORD
   *
   * Because the username is the thing you sign in with. Changing it changes
   * a credential, and a sheet left open on a shared laptop must not be a way
   * to take somebody's sign-in off them, or to have their lists published
   * under a name they would not have chosen. It is the same check
   * `password-change` makes, counted against the same fingerprint, for the
   * same reason.
   *
   * WHY EVERY OTHER DEVICE STAYS SIGNED IN
   *
   * A password is changed because somebody else may have it, so the other
   * sessions go. A name is changed because a better one came along; the
   * account and the secret behind it are exactly what they were, and
   * throwing a person out of their own phone for renaming themselves would
   * be a punishment for tidying up.
   *
   * WHAT IT COSTS THE PERSON DOING IT
   *
   * /u/<the old name> stops answering the moment this lands, and so does
   * every link, screenshot and message pointing at it. The name itself is
   * held for thirty days — see username_holds in db/schema.sql — so what is
   * behind those links is nothing rather than a stranger, and a rename
   * regretted the same afternoon is undone by renaming back. The sheet says
   * both before the button.
   */
  if (action === 'username-change') {
    const user = await sessionUser(request, env);
    if (!user) return json({ error: 'signed-out' }, 401);

    const next = typeof body.username === 'string' ? body.username.trim().toLowerCase() : '';
    const current = typeof body.current === 'string' ? body.current : '';

    if (!USERNAME_RE.test(next)) return json({ error: 'username' }, 400);
    /* Its own answer rather than 'taken', which would be the site telling
       somebody their own name belongs to somebody else. */
    if (next === user.username.toLowerCase()) return json({ error: 'same-name' }, 400);

    const hash = await failHash(env, request);
    if (await tooManyFails(env, hash)) return json({ error: 'slow-down' }, 429);

    /* Before the password and not after it. A name that is gone is gone
       whatever the password is, so checking it first spares a PBKDF2 derive
       — a real fraction of the 10ms this plan allows a request — and spares
       the person typing their password to be told the name was never
       available. It gives nothing away either: the sign-up sheet answers the
       same question, to anybody, with no session at all. */
    if (await nameTaken(env, next, user.id)) return json({ error: 'taken' }, 409);

    /* An account with no password has nothing to ask for here, so this asks
       for nothing: the session is the only credential it has got. That is a
       real difference and worth saying out loud — on a password account a
       sheet left open on a shared laptop is not enough to rename somebody,
       and on a Google-only one it is. Setting a password is what closes it,
       which is the other half of why that step exists. */
    const pw = await passwordOn(env, user.id);
    if (pw.hash && !(await matches(pw, current))) {
      await noteFail(env, hash);
      return json({ error: 'current' }, 401);
    }

    const now = Date.now();
    try {
      await env.DB.batch([
        env.DB.prepare('UPDATE users SET username = ? WHERE id = ?').bind(next, user.id),
        /* OR REPLACE, because the key is the account: what is held is the
           name you were last known by and never a chain of them. */
        env.DB
          .prepare('INSERT OR REPLACE INTO username_holds (user_id, username, released_at) VALUES (?, ?, ?)')
          .bind(user.id, user.username, now),
        /* Swept on the way past, the way login_fails is: a hold nobody can
           still act on is a record of what somebody used to be called, kept
           for nothing. */
        env.DB
          .prepare('DELETE FROM username_holds WHERE released_at < ?')
          .bind(now - HOLD_DAYS * 86400000)
      ]);
    } catch (e) {
      /* Two people taking the same free name in the same second. The unique
         index on users.username is what actually decides it, and the loser
         is told the same thing the check above would have told them. */
      return json({ error: 'taken' }, 409);
    }

    return json({ changed: true, user: next }, 200);
  }

  /* --------------------------------------------- the line about yourself
   *
   * Two hundred characters drawn on /u/<name> under the name, and the only
   * thing anybody writes here about themselves rather than about a
   * restaurant. Empty is a real answer and the way to take one down.
   *
   * NO PASSWORD, UNLIKE THE OTHER TWO CHANGES
   *
   * The password and the username are guarded by the password in use because
   * each is a way to take an account off somebody: one locks them out, the
   * other moves every link that points at them. A line on a page is neither.
   * It is something its author wrote and can rewrite, the way a list's title
   * and its intro are, and those ask for a session and nothing more. Asking
   * for a password to edit a sentence would teach people to type it into a
   * box that did not need it, which is the habit the rest of this file is
   * built not to build.
   *
   * The shaping is the same flatten-and-cut lists.js does to a title, said
   * again in one expression rather than shared: two copies is where
   * .claude/rules/leave-it-better.md leaves it, and a third is a helper.
   */
  if (action === 'about') {
    const user = await sessionUser(request, env);
    if (!user) return json({ error: 'signed-out' }, 401);

    const about = String(typeof body.about === 'string' ? body.about : '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, MAX_ABOUT);

    await env.DB
      .prepare('UPDATE users SET about = ? WHERE id = ?')
      .bind(about, user.id)
      .run();

    return json({ about: about }, 200);
  }

  /* ------------------------------------------------ the name you go by
   *
   * Sixty characters over the line, and the heading of a profile that is a
   * page — "Etibar Ädalät" where the username can only be "etibar". The same
   * shaping and the same terms as the line: a session and no password,
   * empty as the way to take it down, the flatten-and-cut said again rather
   * than shared.
   */
  if (action === 'display') {
    const user = await sessionUser(request, env);
    if (!user) return json({ error: 'signed-out' }, 401);

    const display = String(typeof body.display === 'string' ? body.display : '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, MAX_DISPLAY);

    await env.DB
      .prepare('UPDATE users SET display_name = ? WHERE id = ?')
      .bind(display, user.id)
      .run();

    return json({ display: display }, 200);
  }

  /* ------------------------------------------- where else you are
   *
   * Up to three handles — Instagram, TikTok, Facebook — drawn under the line
   * on /u/<name>. The second thing anybody writes here about themselves
   * rather than about a restaurant, and it asks for a session and no password
   * for the reason the line above it does: it is something its author wrote
   * and can rewrite, not a way to take an account off somebody.
   *
   * ALL THREE AT ONCE, AND EMPTY IS AN ANSWER
   *
   * One form, one Save, one write. A field left empty is a handle taken down
   * rather than a handle left alone, which is what makes the form read as the
   * three links themselves rather than as three separate settings: what you
   * see in the boxes when you press Save is what is on your profile.
   *
   * A FILLED FIELD THAT IS NOT A HANDLE IS REFUSED, NOT DROPPED
   *
   * cleanHandle() answers '' for both "empty" and "not a handle", and the two
   * must not end the same way here. Silently dropping what somebody typed
   * leaves them looking at a profile with no link on it and nothing anywhere
   * saying why. So a field that was filled in and did not clean stops the
   * whole write and names the network it was, and nothing changes until it is
   * a handle or it is empty. See ./_profile.js for what counts as one, and
   * why this takes a handle rather than a URL at all.
   */
  if (action === 'links') {
    const user = await sessionUser(request, env);
    if (!user) return json({ error: 'signed-out' }, 401);

    const next = {};
    for (const net of NETWORKS) {
      const given = String(typeof body[net.id] === 'string' ? body[net.id] : '').trim();
      if (!given) continue;
      const handle = cleanHandle(net.id, given);
      if (!handle) return json({ error: 'bad-link', network: net.id }, 400);
      next[net.id] = handle;
    }

    /* '' rather than '{}' for somebody who has taken all three down, so that
       "never wrote one" and "wrote three and removed them" are the same row —
       the same reasoning DEFAULT_PIN is stored as '' for. */
    const stored = Object.keys(next).length ? JSON.stringify(next) : '';

    await env.DB
      .prepare('UPDATE users SET links = ? WHERE id = ?')
      .bind(stored, user.id)
      .run();

    return json({ links: next }, 200);
  }

  /* ------------------------------------------------ the page of links
   *
   * The rows drawn on /u/<name> under the handles and above the lists — see
   * db/schema.sql for what one is. The third thing anybody writes here about
   * themselves rather than about a restaurant, and it asks for a session and
   * no password for the reason the two above do.
   *
   * ALL OF THEM AT ONCE, IN THEIR ORDER, AND NOTHING IS AN ANSWER
   *
   * One form, one Save, one write: what is in the form when Save is pressed
   * is what is on the page afterwards, so removing a row is how it comes
   * down and an empty form takes the whole page down. The rows are deleted
   * and written again in one batch, so a save that fails halfway leaves the
   * page as it was rather than half of each.
   *
   * A ROW THAT IS NOT ONE IS REFUSED, NOT DROPPED
   *
   * cleanRows() stops at the first row it cannot take and says which, and
   * nothing is written until every row is a row — the same reasoning the
   * handles follow, and the page has the index to put the cursor in the box.
   *
   * NO TABLE YET IS ITS OWN ANSWER
   *
   * profile_rows arrives by hand. A save against a database that has not
   * had it says so, in a word the page can show, rather than the generic
   * one — because this is the one failure a person cannot fix by trying
   * again, and the one the owner can fix in a minute.
   */
  if (action === 'rows') {
    const user = await sessionUser(request, env);
    if (!user) return json({ error: 'signed-out' }, 401);

    const cleaned = cleanRows(body.rows);
    if (cleaned.error) return json({ error: cleaned.error, row: cleaned.row }, 400);

    const writes = [
      env.DB.prepare('DELETE FROM profile_rows WHERE owner = ?').bind(user.id)
    ];
    cleaned.rows.forEach((row, i) => {
      writes.push(env.DB
        .prepare('INSERT INTO profile_rows (owner, position, title, url, note) VALUES (?, ?, ?, ?, ?)')
        .bind(user.id, i, row.title, row.url, row.note));
    });

    try {
      await env.DB.batch(writes);
    } catch (e) {
      if (/no such table/i.test(String((e && e.message) || e))) return json({ error: 'no-rows-table' }, 503);
      throw e;
    }

    /* What was stored, read the way the profile will read it, so the form
       redraws exactly what the page now shows. */
    return json({ rows: await readRows(env, user.id) }, 200);
  }

  /* ------------------------------------------ naming a Google account
   * The second half of the round trip in ./google.js, and the only part of
   * it that is a form.
   *
   * A Google account that has never been here arrives holding a sealed note
   * saying which Google account proved itself, and nothing has been written
   * yet — no half-made row, nothing to sweep if they close the tab. This is
   * where it becomes an account, and the one thing it asks for is the thing
   * this site asks everybody: a name.
   *
   * IT IS NOT ASSEMBLED OUT OF THE GOOGLE PROFILE, AND THAT IS ON PURPOSE
   *
   * Google would hand over a display name and a picture for the asking.
   * ./_google.js asks for neither — the scope is `openid` alone — and this is
   * the reason: the username here is the byline on every list somebody
   * shares and the whole of /u/<name>, so "Etibar H." out of a Google profile
   * would be this site naming somebody out of a directory they did not know
   * it had read. The sheet used to hand out `smoky-walnut-418` for the same
   * job and it was taken out for the same reason. See the header.
   *
   * The account it makes has no password: an empty hash, an empty salt and
   * nought iterations, which `matches` above reads as "no password on this
   * account" and refuses a sign-in against. Setting one later is the
   * password step, which asks for no current password when there is none.
   */
  /* The step itself is `nameGoogleAccount` in ./_account.js, because two
     forms finish it: this sheet, and the feedback composer, where somebody
     who pressed Continue with Google under a half-written sentence names
     themselves without being sent here and back. */
  if (action === 'google-name') {
    const named = await nameGoogleAccount(context, {
      username: body.username,
      client: body.client
    });
    if (!named.ok) return json({ error: named.error }, named.status);

    const made = new Headers({
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store'
    });
    made.append('set-cookie', sessionCookie(named.token, SESSION_DAYS, request));
    /* Spent. It is good for one account and this was it. */
    made.append('set-cookie', pendingCookie(''));
    return new Response(
      JSON.stringify({ user: named.username, saved: await savedByUser(env, named.userId) }),
      { headers: made }
    );
  }

  /* ------------------------------------------------- disconnecting Google
   * Connecting is a link to /api/google, because it is a round trip. Taking
   * it off again is this, because it is one row.
   *
   * ONLY WHERE THERE IS A PASSWORD TO FALL BACK ON
   *
   * An account reached only through Google, with Google taken off, is an
   * account nobody can ever sign into again — and there is no reset here to
   * rescue it with. So the button is refused rather than offered and
   * regretted, and the account page says why: set a password first. It is
   * the same shape as the rule that a password change signs the other
   * devices out — the site will not quietly leave somebody locked out of
   * their own things.
   */
  if (action === 'google-unlink') {
    const user = await sessionUser(request, env);
    if (!user) return json({ error: 'signed-out' }, 401);

    const pw = await passwordOn(env, user.id);
    if (!pw.hash) return json({ error: 'needs-password' }, 409);

    await unlinkGoogle(env, user.id);
    return json({ linked: false }, 200);
  }

  /* ---------------------------------------- making one, and entering one
   * The sheet has two buttons and this route has two actions, because on a
   * form that exists to ask "have you been here before" the answer to a name
   * that is already somebody's has to be "that username is taken" and never a
   * sign-in. `enterAccount` in ./_account.js is the step itself — the name
   * rule, the password floor, the hold on a released name, the slow-down on a
   * fingerprint that keeps guessing, the PBKDF2 compare, the quiet upgrade of
   * a hash made at fewer iterations, the session and the saves this browser
   * is bringing with it — and `mode` is the one thing the callers disagree
   * about. The third caller is the feedback composer, where a name nobody has
   * makes an account and one that exists signs you in, because there is no
   * sheet there to ask the question twice.
   */
  if (action !== 'create' && action !== 'login') return json({ error: 'action' }, 400);

  const entered = await enterAccount(context, {
    username: body.username,
    password: body.password,
    client: body.client,
    mode: action
  });
  if (!entered.ok) return json({ error: entered.error }, entered.status);

  return new Response(
    JSON.stringify({ user: entered.username, saved: await savedByUser(env, entered.userId) }),
    {
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'no-store',
        'set-cookie': sessionCookie(entered.token, SESSION_DAYS, request)
      }
    }
  );
}
