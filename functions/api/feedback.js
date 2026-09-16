/**
 * Tallinn Tastebuds — the feedback page's one endpoint.
 *
 * /feedback is where anybody says what they would change about this site, and
 * puts a heart on what somebody else said. This is the whole of what that
 * page talks to: GET reads a page of it, POST says a thing, hearts one,
 * takes a heart back, or removes one of your own.
 *
 * WHO A ROW BELONGS TO, WHICH IS THE SAVES' ARRANGEMENT AND NOT THE LISTS'
 *
 * One column, `owner`, holding a users.id when the request carries a session
 * and the browser's own random UUID when it does not — exactly as
 * functions/api/saves.js files a save, and for the same reason. Saying
 * something here has to work in the first ten seconds, before anybody has
 * decided anything about this site, and a page that asks for an account
 * before it will take a complaint is a page that never hears the complaint
 * worth hearing. A list is the other shape of thing and needs an account;
 * this is not a list.
 *
 * So a heart is one row per (feedback, owner) and is as honest as an account
 * is, which is the same caveat /api/saves carries about its own numbers:
 * nobody runs a number up by pressing twice, and anybody willing to clear
 * their storage ten times can add ten. Nothing here is ranked against
 * anything outside this page, so what that buys is a bigger number and not a
 * better position anywhere.
 *
 * PUTTING YOUR NAME ON IT IS A SIGN-IN, AND IT HAPPENS IN THE SAME REQUEST
 *
 * `say` with `as: 'name'` and no session carries a username and a password,
 * and the account is made or entered on the way past — see enterAccount() in
 * ./_account.js, which is the step the map's sheet takes too. There is no
 * second form and no round trip: somebody who has just written a sentence
 * about this site should not have to go to another page, sign in there, come
 * back and write it again.
 *
 * The other way in is Continue with Google, and it ends here too. The round
 * trip through /api/google with `?then=/feedback` comes back either signed in
 * — nothing left to do — or holding a sealed note saying a Google account has
 * proved itself and has never been here before. That one still needs a name,
 * and it is asked for in this same composer rather than on the map's sheet:
 * `say` takes the name, nameGoogleAccount() makes the account, and the
 * sentence somebody left the page holding is posted under it. Sending them to
 * the map to be named and back again would be the round trip this whole
 * arrangement exists to avoid, one page later.
 *
 * WHAT IS STORED
 *
 *   feedback        the sentence, who wrote it, whether their name shows, a
 *                   hashed network fingerprint for the cap, and when. Never
 *                   the address itself.
 *   feedback_hearts one row per person per piece of feedback.
 *
 * BOTH TABLES ARRIVE BY HAND, AND EVERY READ HERE SURVIVES THEIR ABSENCE
 *
 * db/schema.sql is applied by a person and the code is live the moment it is
 * pushed, so there is always a window where this route is asking for tables
 * that are not there yet. Inside it the page draws its head, its sentence and
 * its composer out of data/ui.json and says it could not load the feedback,
 * which is a state it has anyway; what it must never do is answer 500. Same
 * bargain `users.about` takes in ./account.js and `lists.pin` takes in
 * ./_pins.js — the missing piece costs itself and nothing around it.
 */

import {
  json, sessionUser, wrongDatabase, randomHex, fingerprint, clientIp,
  sessionCookie, SESSION_DAYS
} from './_lib.js';
import { enterAccount, nameGoogleAccount, googlePending } from './_account.js';
import { googleReady, pendingCookie } from './_google.js';

/* Five hundred characters. Long enough for a paragraph about what is wrong
   with the filter chips, short enough that the page stays a page of things
   people said rather than a page of essays — and the same bargain a list's
   intro and the line about yourself take at two hundred. Restated as a
   `maxlength` on the field in assets/feedback.js, the way every cap on this
   site is; see **The caps** in README.md. */
const MAX_FEEDBACK = 500;

/* How many pieces of feedback one network fingerprint may leave in an hour.
 *
 * Three, and it is a cap rather than a queue: the fourth in an hour is
 * somebody hammering the form, and everybody with something to say has said
 * it by the third. The same fingerprint the saves are capped by — an HMAC of
 * the address and the user agent under SAVE_SALT, so the address itself never
 * reaches the table and cannot be recovered from what does. Estonian carriers
 * put thousands of phones behind one address, so this is deliberately not
 * "one per person": three an hour leaves a table of friends room to each say
 * something and still stops the loop this is here to stop. */
const PER_HOUR_CAP = 3;
const HOUR = 60 * 60 * 1000;

/* Twenty at a time, and Show more under them. */
const PAGE = 20;

/* How long a new piece of feedback stands above the order before its hearts
 * decide where it sits.
 *
 * The page has one order and no chips to choose it with — see **Feedback** in
 * README.md — and that order is "the most hearted first". On its own, that is
 * a page where nothing new is ever seen: a sentence posted this afternoon
 * starts at nought hearts, sits below everything that has ever been agreed
 * with, and is therefore never read by anybody who might agree with it. Ten
 * minutes at the top is what breaks that loop. It is long enough for the
 * people who happen to be on the page to see it and short enough that the
 * page is not a chronological feed with extra steps.
 *
 * One constant, and the obvious thing to raise: on a page few people open in
 * any given minute, an hour is the better number. It is here rather than in
 * the SQL so that changing it is changing this line.
 */
const FRESH_MS = 10 * 60 * 1000;

/* A UUID and nothing else. The device id stands in for an account on this
   page — it owns rows and hearts — so its shape is checked before it is
   allowed anywhere near a table, the way /api/saves checks it. */
const CLIENT_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/* Who is acting: the account if there is a session, otherwise this browser.
   `id` is what goes in the owner column and `kind` is what says which of the
   two it is. An empty id is somebody with no session and no device id — they
   can read the page and nothing else, and every write below refuses them.

   `from` is wherever the device id was sent: the body on a write, the query
   string on the read, since a GET has no body to put it in. */
function actor(user, from) {
  if (user) return { id: user.id, kind: 'user' };
  const client = typeof from.client === 'string' ? from.client : '';
  return { id: CLIENT_RE.test(client) ? client : '', kind: 'device' };
}

/* The text as it will be stored. Newlines survive — somebody may write two
   paragraphs and the page draws them — but a run of blank lines is somebody
   leaning on return, and the cap is counted after the tidying rather than
   before it, so a person is not refused for whitespace they cannot see. It
   reaches the page as textContent and never as markup, so there is nothing
   here to escape. */
function shape(text) {
  return String(typeof text === 'string' ? text : '')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, MAX_FEEDBACK);
}

/* ------------------------------------------------------------- reading it
 * GET /api/feedback?page=<n> — twenty rows in the page's one order.
 *
 * THE ORDER, WHICH IS ONE EXPRESSION AND WORTH READING TWICE
 *
 * Anything posted inside FRESH_MS stands above everything else, newest of
 * those first; everything older sits where its hearts put it, newest first
 * between two with the same number. That is the CASE below: for a fresh row
 * the second key is its own timestamp, for an old one it is the heart count,
 * and the first key is what keeps the two groups apart so the two kinds of
 * number are never compared with each other.
 *
 * The hearts come off a LEFT JOIN and a GROUP BY rather than a counts table,
 * which is the argument the note over `list_keeps` in db/schema.sql makes at
 * length: a counts table is a migration and a backfill on a live database
 * with no backup, plus a second place for the same number to live and a way
 * for the two to disagree. Counting costs one row read per heart. The day
 * that shows up in a query time is the day to write one, and it should be
 * written the way save_counts is — recomputed inside the batch that changes
 * it, never nudged by one.
 *
 * OFFSET rather than a cursor, and deliberately: a cursor has to be a value
 * the order can be resumed from, and this order is partly a count that
 * changes while somebody is reading. Twenty rows a page over a table this
 * size is a handful of pages, and a row moving between them because somebody
 * hearted it mid-scroll is the truth arriving rather than a bug.
 */
export async function onRequestGet(context) {
  const { request, env } = context;

  if (!env.DB) return json({ ready: false, rows: [], more: false }, 200);
  if (await wrongDatabase(env)) return json({ ready: false, rows: [], more: false }, 200);

  const url = new URL(request.url);
  const asked = parseInt(url.searchParams.get('page') || '0', 10);
  /* A page number out of somebody's address bar decides an OFFSET, so it is
     held to a number and to a ceiling rather than passed along as typed. */
  const page = Number.isFinite(asked) && asked > 0 ? Math.min(asked, 500) : 0;

  const user = await sessionUser(request, env);
  const me = actor(user, { client: url.searchParams.get('client') || '' });
  const fresh = Date.now() - FRESH_MS;

  let results;
  try {
    /* One statement answers all four questions a row needs: the sentence, who
       wrote it, how many hearts it has, and whether the person reading has
       put one on it. `mine` comes out of the same comparison as `hearted` and
       costs nothing extra.

       LIMIT is asked for one more than a page so that `more` is a fact rather
       than a guess — a second COUNT(*) over the table to find out whether
       there is a twenty-first row would be the more expensive way to learn
       less. */
    const answer = await env.DB
      .prepare(
        'SELECT f.id AS id, f.named AS named, f.text AS text, f.created_at AS created_at, ' +
        'u.username AS username, ' +
        'COUNT(h.owner) AS hearts, ' +
        'MAX(CASE WHEN h.owner = ? THEN 1 ELSE 0 END) AS hearted, ' +
        'CASE WHEN f.owner = ? THEN 1 ELSE 0 END AS mine ' +
        'FROM feedback f ' +
        'LEFT JOIN users u ON u.id = f.owner ' +
        'LEFT JOIN feedback_hearts h ON h.feedback_id = f.id ' +
        'WHERE f.hidden = 0 ' +
        'GROUP BY f.id ' +
        'ORDER BY (f.created_at > ?) DESC, ' +
        'CASE WHEN f.created_at > ? THEN f.created_at ELSE hearts END DESC, ' +
        'f.created_at DESC ' +
        'LIMIT ? OFFSET ?'
      )
      .bind(me.id, me.id, fresh, fresh, PAGE + 1, page * PAGE)
      .all();
    results = answer.results || [];
  } catch (e) {
    /* No tables yet — see the header. The page says it could not load the
       feedback, which is exactly what has happened, and everything else on it
       still draws. */
    return json({ ready: false, rows: [], more: false }, 200);
  }

  const more = results.length > PAGE;
  const rows = results.slice(0, PAGE).map((row) => ({
    id: row.id,
    /* The name only where its author asked for it. An anonymous row still
       carries an owner — it is still theirs to remove and it still counts
       against their cap — and that owner is never sent to anybody. */
    name: row.named ? row.username || null : null,
    text: row.text,
    at: row.created_at,
    hearts: row.hearts || 0,
    hearted: !!row.hearted,
    mine: !!row.mine
  }));

  return json({
    ready: true,
    /* Who the page is drawing for, so it can put a name on the composer's
       own choice without a second request to /api/account. */
    me: user ? user.username : null,
    /* Whether Continue with Google can be offered here at all — the same
       question `/api/account` answers for the map's sheet, and asked for the
       same reason: on a deployment with no Google client set the button would
       lead somewhere that can only send them back saying it failed. */
    google: googleReady(env),
    /* A Google account that has proved itself and has not been named yet, so
       the composer asks for a name and no password. Only worth asking when
       there is no session — with one, the trip is over. */
    naming: !user && (await googlePending(request, env)),
    rows: rows,
    more: more
  }, 200);
}

/* -------------------------------------------------------------- saying it
 * POST /api/feedback — { action: 'say' | 'heart' | 'unheart' | 'remove' }.
 */
export async function onRequestPost(context) {
  const { request, env } = context;

  if (!env.DB) return json({ error: 'no-database' }, 503);
  if (await wrongDatabase(env)) return json({ error: 'wrong-database' }, 503);
  /* Fail closed, the way every write on this site does without the salt: the
     cap below is a hashed fingerprint and a plain hash of an address is
     guessable given the whole of IPv4. */
  if (!env.SAVE_SALT) return json({ error: 'no-salt' }, 503);

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return json({ error: 'malformed' }, 400);
  }

  const action = body.action;
  if (action !== 'say' && action !== 'heart' && action !== 'unheart' && action !== 'remove') {
    return json({ error: 'action' }, 400);
  }

  let user = await sessionUser(request, env);
  /* The cookies a sign-in taken on the way past this request has to set: the
     session, and — where the trip came through Google — the spent note being
     cleared, since it is good for one account and that was it.

     They ride on whatever this call answers with, including a refusal, which
     is the case worth saying out loud: once the account step has returned,
     the account exists and the session is open in the database, so an answer
     that dropped the cookie because the insert after it failed would leave
     somebody with an account they were never signed in to and a password they
     would now have to remember typing. */
  const cookies = [];

  if (action === 'say') {
    const text = shape(body.text);
    if (!text) return json({ error: 'empty' }, 400);

    /* Whether the name goes on it. Signed out, `name` is a request to make an
       account or enter one, and the two fields under the choice are what it
       is made with; signed in, it is simply which of the two the composer's
       choice was left on. */
    const named = body.as === 'name';

    if (named && !user) {
      /* Two doors, and the browser is already holding the answer to which.
         A sealed note from /api/google means somebody pressed Continue with
         Google a moment ago and Google has proved who they are — so there is
         no password to ask for and none to check, and what is left is the
         name. Without one it is the ordinary username and password, which
         makes an account or enters one.

         Asked in this order because the note is the stronger claim: somebody
         mid-round-trip who also typed something into the name field is still
         mid-round-trip, and naming the Google account is what they came back
         to do. */
      const viaGoogle = await googlePending(request, env);
      const entered = viaGoogle
        ? await nameGoogleAccount(context, {
            username: body.username,
            client: body.client
          })
        : await enterAccount(context, {
            username: body.username,
            password: body.password,
            client: body.client,
            mode: 'either'
          });
      if (!entered.ok) return json({ error: entered.error }, entered.status);
      user = { id: entered.userId, username: entered.username };
      cookies.push(sessionCookie(entered.token, SESSION_DAYS, request));
      if (viaGoogle) cookies.push(pendingCookie(''));
    }

    const me = actor(user, body);
    /* Nobody at all: no session, and no device id to file it under. The page
       mints one before it ever posts, so this is a hand-made request. */
    if (!me.id) return json({ error: 'client' }, 400);

    const hash = await fingerprint(
      env.SAVE_SALT, clientIp(request), request.headers.get('User-Agent') || ''
    );

    try {
      const seen = await env.DB
        .prepare('SELECT COUNT(*) AS n FROM feedback WHERE ip_hash = ? AND created_at > ?')
        .bind(hash, Date.now() - HOUR)
        .first();
      if (seen && seen.n >= PER_HOUR_CAP) return answer({ error: 'often' }, cookies, 429);

      const id = randomHex(8);
      /* One reading of the clock, written to the row and handed back with it.
         Two calls to Date.now() either side of an insert differ by a few
         milliseconds, and the page would then hold a row whose timestamp is
         not the one in the table — invisible today, and exactly the kind of
         thing that is baffling the day anything starts comparing them. */
      const at = Date.now();
      await env.DB
        .prepare(
          'INSERT INTO feedback (id, owner, owner_kind, named, text, ip_hash, created_at, hidden) ' +
          'VALUES (?, ?, ?, ?, ?, ?, ?, 0)'
        )
        .bind(id, me.id, me.kind, named ? 1 : 0, text, hash, at)
        .run();

      return answer({
        said: {
          id: id,
          name: named && user ? user.username : null,
          text: text,
          at: at,
          hearts: 0,
          hearted: false,
          mine: true
        },
        /* Whether an account was made or entered in this same request, so the
           page can say so above the field rather than leaving somebody to
           notice their name in the header. */
        me: user ? user.username : null
      }, cookies);
    } catch (e) {
      /* The table is not there yet — see the header — or the write failed for
         some other reason, which this deliberately does not try to tell apart:
         either way nothing was stored, the sentence is still in the field, and
         the page says it did not go through. */
      return answer({ error: 'no-table' }, cookies, 503);
    }
  }

  /* ------------------------------------------------------------ the heart
   * One row per (feedback, owner), so pressing twice is the conflict clause
   * and never a second row — which is what makes the count a count of people
   * rather than a count of presses.
   */
  const id = typeof body.id === 'string' ? body.id : '';
  if (!/^[0-9a-f]{16}$/.test(id)) return json({ error: 'id' }, 400);

  const me = actor(user, body);
  if (!me.id) return json({ error: 'client' }, 400);

  let row;
  try {
    row = await env.DB
      .prepare('SELECT owner FROM feedback WHERE id = ? AND hidden = 0')
      .bind(id)
      .first();
  } catch (e) {
    return json({ error: 'no-table' }, 503);
  }
  if (!row) return json({ error: 'gone' }, 404);

  if (action === 'remove') {
    /* Only ever your own, said twice on purpose: the check is what gives an
       honest answer, and the owner in the WHERE below is what makes the
       statement itself incapable of taking somebody else's row even if this
       check is ever edited away. Its hearts go with it in the same batch — a
       heart on a sentence that is not there any more is a row nothing can
       ever read. */
    if (row.owner !== me.id) return json({ error: 'not-yours' }, 403);
    await env.DB.batch([
      env.DB.prepare('DELETE FROM feedback WHERE id = ? AND owner = ?').bind(id, me.id),
      env.DB.prepare('DELETE FROM feedback_hearts WHERE feedback_id = ?').bind(id)
    ]);
    return json({ removed: id }, 200);
  }

  /* Nobody hearts their own. The page draws a number rather than a button on
     a row you wrote, so this is the request nothing on the page makes — and
     it is refused here because the page is not what decides. */
  if (row.owner === me.id) return json({ error: 'own' }, 403);

  if (action === 'heart') {
    await env.DB
      .prepare(
        'INSERT INTO feedback_hearts (feedback_id, owner, created_at) VALUES (?, ?, ?) ' +
        'ON CONFLICT DO NOTHING'
      )
      .bind(id, me.id, Date.now())
      .run();
  } else {
    await env.DB
      .prepare('DELETE FROM feedback_hearts WHERE feedback_id = ? AND owner = ?')
      .bind(id, me.id)
      .run();
  }

  /* The number the table actually holds, which is not necessarily the one the
     page guessed: somebody else may have hearted it in the meantime, and a
     second press that hit the conflict clause added nothing at all. */
  const total = await env.DB
    .prepare('SELECT COUNT(*) AS n FROM feedback_hearts WHERE feedback_id = ?')
    .bind(id)
    .first();

  return json({
    id: id,
    hearts: total ? total.n : 0,
    hearted: action === 'heart'
  }, 200);
}

/* json() with a Set-Cookie on it, for the three answers `say` can give once a
   session has been opened on the way past. Everything before that point, and
   every heart, goes through json(): there is no cookie to carry and building
   one answer two ways would be two things to keep in step. */
function answer(body, cookies, status) {
  const headers = new Headers({
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store'
  });
  (cookies || []).forEach((cookie) => headers.append('set-cookie', cookie));
  return new Response(JSON.stringify(body), { status: status || 200, headers: headers });
}
