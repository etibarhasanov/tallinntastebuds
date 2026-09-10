/**
 * Tallinn Tastebuds — splitwise, the thing that happens after dinner.
 *
 * Five people eat, one card pays, and the rest of the evening is arithmetic
 * done badly in a group chat. This is the arithmetic done once: a group
 * somebody names, a link they send to the other four, a line for each thing
 * anybody paid for, and one sentence at the bottom saying who hands what to
 * whom. It lives on its own subdomain — splitwise.tallinntastebuds.ee, routed
 * by functions/_middleware.js — because it is not the map and should not
 * pretend to be.
 *
 * IT IS THE SAME ACCOUNT, AND THAT IS THE WHOLE OF THE INTEGRATION
 *
 * There is no second users table, no second password, no second sign-in
 * route. A member is a `users.id` out of functions/api/account.js, made from
 * the same two fields the map's sheet asks for. Somebody who has been saving
 * places for a year is already somebody who can be owed eleven euros, and
 * somebody who signs up here to split a bill can go and save places with the
 * same name afterwards.
 *
 * The one thing that had to change for that to work across two hostnames is
 * in sessionCookie() in ./_lib.js: the session cookie is scoped to the domain
 * rather than to the host, so signing in on the map is being signed in here.
 * See the note there — it is the only part of this feature that reaches into
 * the rest of the site.
 *
 * WHAT THE WIRE CARRIES, AND WHAT IT DOES NOT
 *
 * Every person in every answer here is a **username**, never a `users.id`.
 * The id is the site's internal handle — it is the owner column on a save, a
 * list and a place somebody added — and there is no reason for four friends
 * to learn each other's. A username is already public: it is the byline on
 * every list on this site. So the id stops at this file, the names go out,
 * and a request that names a payer names them the way the page drew them.
 *
 * EVERY AMOUNT IS AN INTEGER NUMBER OF CENTS, ON THE WIRE AND IN THE TABLE
 *
 * The browser parses "12,50" and sends 1250. Nothing here ever sees a
 * decimal, because money in a float is the bug that takes a year to surface:
 * three shares of 33.33 against a total of 100.00 that never quite balances,
 * and no way to say which cent went missing. An expense divided between three
 * people is divided with integer division and the remainder handed out, so
 * the shares sum to the total exactly — see share().
 *
 * WHAT THIS FILE IS ALLOWED TO DO
 *
 * The same rules functions/api/lists.js is written to, because the argument
 * is the same one: D1 has no public endpoint, so the attack surface of these
 * tables is exactly this file.
 *
 *   - Every query is a prepared statement with bound parameters. Nothing from
 *     a request is ever concatenated into SQL.
 *   - Every action but two names a group, and the first thing done with that
 *     name is to read the caller's own membership of it. A caller who is not a
 *     member is told the group does not exist — anything else would make this
 *     a way of asking which invitation codes are taken. The two are `create`,
 *     which names no group, and `join`, whose whole purpose is a group you are
 *     not in yet; both are routed above that check and do their own.
 *   - Every person named in a write — a payer, the people a bill is split
 *     between, either end of a payment — is checked against that group's
 *     members before a row is written. A username that is not in the group is
 *     refused rather than dropped.
 *   - Everything anybody types is capped in length before it is stored, and
 *     the counts below cap how much of it there can be.
 *
 * NOTHING HERE IS CACHED, for the reason lists.js gives at more length: this
 * is a page people are looking at together while they change it, and an
 * answer thirty seconds behind is the feature appearing to have lost what
 * somebody just typed.
 */

import { json, sessionUser, wrongDatabase, randomHex } from './_lib.js';

/* Caps. All of them are about somebody with a script rather than somebody
   with a dinner, with one exception.
 *
 * MAX_MEMBERS is the exception, and it is a judgement about the feature. This
 * is for the table you are sitting at: four, five, eight people who ate
 * together and are working out the change. Twelve is well past that and still
 * a number of people who could plausibly have shared a bill — past it, the
 * suggested payments below stop being something anybody reads and the thing
 * being asked for is a different feature.
 */
const MAX_GROUPS = 20;
const MAX_MEMBERS = 12;
const MAX_ENTRIES = 200;
const MAX_NAME = 60;
const MAX_WHAT = 60;
/* Ten thousand euros, in cents. High enough that nobody splitting a dinner
   ever meets it and low enough that a typo of six extra digits is refused at
   the door rather than sitting in somebody's balance. */
const MAX_CENTS = 1000000;

/* The invitation's shape, and the same one a list's id has: a readable stem
   and six random characters. */
const GROUP_ID = /^[a-z0-9][a-z0-9-]{2,47}$/;
const CODE_LENGTH = 6;

/* An expense's id and a payment's. Random and nothing else — unlike a group,
   these never appear in a URL and nobody reads one. */
const ENTRY_ID = /^[0-9a-f]{16}$/;

function entryId() {
  return randomHex(8);
}

/* ---------------------------------------------- minting a group's own code
 * The three below are a deliberate second copy of what functions/api/lists.js
 * does for a list's id, and the duplication is the point rather than an
 * oversight.
 *
 * They were pulled up into ./_lib.js for a while, which is what this codebase
 * does with anything two routes share — nearTallinn() says so in its own note.
 * That was the right call for a permanent feature and the wrong one for this:
 * splitwise is meant to be removable in an afternoon, and a shared helper is
 * exactly the thread that makes a deletion turn into an unpicking. Sixty lines
 * of drift-free arithmetic in the file that will be deleted whole beats three
 * functions in a file that will not.
 *
 * If splitwise is kept, this is the first thing to reconsider: two copies of
 * how an unguessable invitation is minted is two copies that can drift, and by
 * then the argument above has expired. Until that is decided, they stay here.
 *
 * No vowels, so a code cannot spell anything; no 0/o/1/l, so it survives being
 * read off one phone screen and typed into another.
 */
const CODE_ALPHABET = '23456789bcdfghjkmnpqrstvwxyz';

function shareCode(length) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let out = '';
  for (let i = 0; i < length; i++) out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  return out;
}

/* The readable half, so a pasted link says what it is before anybody opens it.
   A name with no Latin letters in it at all — there will be some, the site is
   read in ten languages — leaves "group" standing on its own in front of the
   code. */
function slugOf(name) {
  const s = String(name || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32)
    .replace(/-+$/g, '');
  return s || 'group';
}

/* Trim, cap, and flatten the newlines somebody's phone keyboard put in, so no
   field here can be stored longer than the page that draws it. */
function words(value, max) {
  return String(typeof value === 'string' ? value : '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

/* ------------------------------------------------------------------ people
 * Every member of one group, in the order they joined, with the two things
 * this file needs about each: the id the tables are keyed on and the name the
 * page draws. The join is exact and there is no copy of the username on the
 * member row — see split_members in db/schema.sql for why.
 */
async function membersOf(env, groupId) {
  const { results } = await env.DB
    .prepare(
      'SELECT m.user_id AS id, u.username AS name FROM split_members m ' +
      'JOIN users u ON u.id = m.user_id WHERE m.group_id = ? ORDER BY m.joined_at'
    )
    .bind(groupId)
    .all();
  return results || [];
}

/* The group this request is about, or null — where null covers a group that
   does not exist, a malformed code and a group the caller is not in, on
   purpose. Every read and every write in this file starts here. */
async function groupFor(env, id, user) {
  if (!GROUP_ID.test(String(id || ''))) return null;
  const row = await env.DB
    .prepare(
      'SELECT g.id AS id, g.name AS name, g.owner AS owner FROM split_groups g ' +
      'JOIN split_members m ON m.group_id = g.id AND m.user_id = ? WHERE g.id = ?'
    )
    .bind(user.id, id)
    .first();
  return row || null;
}

/* A username as the page sent it back, resolved against the people actually
   in this group. Case-folded because that is how the account route matches a
   name on the way in, and refused rather than ignored when it is nobody
   here: a bill split between somebody who is not in the group would be a
   share nobody can ever pay. */
function memberByName(members, name) {
  const want = String(typeof name === 'string' ? name : '').trim().toLowerCase();
  if (!want) return null;
  for (const m of members) if (m.name.toLowerCase() === want) return m;
  return null;
}

/* ---------------------------------------------------------------- dividing
 * One expense, split between the people it was split between.
 *
 * Integer division with the remainder handed to the first few in the list, so
 * the shares sum to the total to the cent, always. 10.00 between three is
 * 3.34, 3.33, 3.33 — somebody has to have the extra cent and it is better
 * that it is written down than that it is lost.
 *
 * The order is the order the group is in, which is the order people joined,
 * so the same bill split twice divides the same way rather than moving a cent
 * around between reads.
 */
function share(cents, among) {
  const each = Math.floor(cents / among.length);
  let over = cents - each * among.length;
  return among.map((m) => {
    const extra = over > 0 ? 1 : 0;
    over -= extra;
    return { id: m.id, cents: each + extra };
  });
}

/* ---------------------------------------------------------------- balances
 * What each person is up or down, over the whole life of the group.
 *
 *   what they paid for  +  what they have handed over since
 *   - what they owe     -  what has been handed to them
 *
 * Positive is owed to them, negative is owed by them, and the whole column
 * sums to zero — every cent that leaves one balance arrives in another,
 * which is what the remainder in share() is protecting.
 */
function balancesOf(members, spends, payments) {
  const net = new Map(members.map((m) => [m.id, 0]));
  const add = (id, cents) => {
    if (net.has(id)) net.set(id, net.get(id) + cents);
  };

  for (const spend of spends) {
    add(spend.payerId, spend.cents);
    for (const s of spend.shares) add(s.id, -s.cents);
  }
  for (const p of payments) {
    add(p.payerId, p.cents);
    add(p.payeeId, -p.cents);
  }

  return members.map((m) => ({ name: m.name, cents: net.get(m.id) }));
}

/* Who hands what to whom, as the shortest list of payments that clears the
 * column above.
 *
 * The greedy pairing — biggest debt against biggest credit, repeat — is not
 * guaranteed to be the theoretical minimum number of transfers, which is an
 * NP-hard problem nobody at a dinner table has. It is guaranteed to clear the
 * balances, to need at most one payment fewer than there are people, and to
 * be the same answer every time it is asked, which is what a page people are
 * reading together needs.
 *
 * A balance already at zero produces nothing, so the usual answer for a group
 * where everybody paid for something is two or three lines rather than
 * twenty.
 */
function settlements(balances) {
  const owed = balances.filter((b) => b.cents > 0)
    .sort((a, b) => b.cents - a.cents || a.name.localeCompare(b.name));
  const owing = balances.filter((b) => b.cents < 0)
    .sort((a, b) => a.cents - b.cents || a.name.localeCompare(b.name));

  const out = [];
  let i = 0;
  let j = 0;
  let credit = owed.length ? owed[0].cents : 0;
  let debt = owing.length ? -owing[0].cents : 0;

  while (i < owed.length && j < owing.length) {
    const move = Math.min(credit, debt);
    if (move > 0) out.push({ from: owing[j].name, to: owed[i].name, cents: move });
    credit -= move;
    debt -= move;
    if (credit === 0) { i++; credit = i < owed.length ? owed[i].cents : 0; }
    if (debt === 0) { j++; debt = j < owing.length ? -owing[j].cents : 0; }
  }

  return out;
}

/* ------------------------------------------------------------------- read
 * GET /api/split              the groups this person is in
 * GET /api/split?group=<id>   one group, whole: who is in it, what was paid,
 *                             where everybody stands and who pays whom
 * GET /api/split?join=<id>    what a group is called, for somebody who is
 *                             holding the link and is not in it yet — signed
 *                             out included
 */
export async function onRequestGet(context) {
  const { request, env } = context;

  /* The same three conditions the account and lists routes report, for the
     same reason: the page draws the offer of an account or the reason there
     is none, rather than a form that could only fail. */
  const ready = !!(env.DB && env.SAVE_SALT) && !(await wrongDatabase(env));
  if (!ready) return json({ ready: false, user: null, groups: [] }, 200);

  const params = new URL(request.url).searchParams;
  const user = await sessionUser(request, env);
  const who = user ? user.username : null;

  /* The invitation: what a group is called and how many people are already in
     it, for somebody the group has never heard of — so the page can ask "join
     Dinner at Rataskaevu?" rather than "join k3fmqw?".
   *
     This is the one read here that answers about a group the caller is not a
     member of, and the one that answers signed out at all. Both are safe for
     the reason a public list is safe: the code is six random characters on the
     end of a stem, so holding it is the permission, and somebody holding it is
     one press from being handed the whole group anyway. What it never answers
     with is an expense, a balance or another member's name — joining is what
     buys those.
   *
     Signed out matters, and it is why this sits above the check below rather
     than under it. Somebody handed a link who has no account here sees the
     sign-up form; with this, the group's name is above that form, so what they
     are being asked to make an account for is on the screen while they are
     deciding. */
  const invite = params.get('join') || '';
  if (invite) {
    if (!GROUP_ID.test(invite)) return json({ ready: true, user: who, error: 'not-found' }, 404);
    const row = await env.DB
      .prepare(
        'SELECT g.name AS name, (SELECT COUNT(*) FROM split_members WHERE group_id = g.id) AS people ' +
        'FROM split_groups g WHERE g.id = ?'
      )
      .bind(invite)
      .first();
    if (!row) return json({ ready: true, user: who, error: 'not-found' }, 404);
    return json({
      ready: true,
      user: who,
      invite: { id: invite, name: row.name, people: row.people, full: row.people >= MAX_MEMBERS }
    }, 200);
  }

  if (!user) return json({ ready: true, user: null, groups: [] }, 200);

  const asked = params.get('group') || '';
  if (asked) {
    const group = await groupFor(env, asked, user);
    /* No such group, and one this person is not in, are the same answer. */
    if (!group) return json({ ready: true, user: who, error: 'not-found' }, 404);
    return json({ ready: true, user: who, group: await readGroup(env, group, user) }, 200);
  }

  return json({ ready: true, user: who, groups: await readGroups(env, user) }, 200);
}

/* The front page: every group this person is in, what it is called, how many
 * people are in it, and where this person stands in it. The balance is the one
 * number worth carrying into a list of groups — "you are owed 14.20" is why
 * somebody opens one.
 *
 * One statement, whatever the number of groups. It was written as a loop that
 * read each group whole and pulled the caller's line out of the balances, and
 * that was four queries per group — eighty of them on an account holding the
 * twenty MAX_GROUPS allows, to draw twenty rows of two facts each. The three
 * correlated sums below are the same arithmetic as balancesOf(), narrowed to
 * one person: what they paid for, less what they owe, plus what they have
 * handed over net of what has been handed to them.
 *
 * They are correlated subqueries and not a join, because three sums over three
 * tables in one join multiply each other's rows. Each is over one group's rows
 * on an indexed column.
 */
async function readGroups(env, user) {
  const { results } = await env.DB
    .prepare(
      'SELECT g.id AS id, g.name AS name, ' +
      '(SELECT COUNT(*) FROM split_members WHERE group_id = g.id) AS people, ' +
      '(SELECT COALESCE(SUM(cents), 0) FROM split_expenses ' +
      ' WHERE group_id = g.id AND payer = ?1) AS paid, ' +
      '(SELECT COALESCE(SUM(s.cents), 0) FROM split_shares s ' +
      ' JOIN split_expenses e ON e.id = s.expense_id ' +
      ' WHERE e.group_id = g.id AND s.user_id = ?1) AS owes, ' +
      '(SELECT COALESCE(SUM(CASE WHEN payer = ?1 THEN cents ELSE -cents END), 0) ' +
      ' FROM split_settlements WHERE group_id = g.id AND (payer = ?1 OR payee = ?1)) AS moved ' +
      'FROM split_groups g JOIN split_members m ON m.group_id = g.id AND m.user_id = ?1 ' +
      'ORDER BY g.updated_at DESC LIMIT ?2'
    )
    .bind(user.id, MAX_GROUPS)
    .all();

  return (results || []).map((row) => ({
    id: row.id,
    name: row.name,
    people: row.people,
    cents: row.paid - row.owes + row.moved
  }));
}

/* One group, and everything the page draws of it, off four reads in one
   round trip. */
async function readGroup(env, group, user) {
  const [members, spendRows, shareRows, paymentRows] = await env.DB.batch([
    env.DB
      .prepare(
        'SELECT m.user_id AS id, u.username AS name FROM split_members m ' +
        'JOIN users u ON u.id = m.user_id WHERE m.group_id = ? ORDER BY m.joined_at'
      )
      .bind(group.id),
    env.DB
      .prepare(
        'SELECT id, payer, what, cents, added_by, created_at FROM split_expenses ' +
        'WHERE group_id = ? ORDER BY created_at DESC LIMIT ?'
      )
      .bind(group.id, MAX_ENTRIES),
    env.DB
      .prepare(
        'SELECT s.expense_id AS expense_id, s.user_id AS user_id, s.cents AS cents ' +
        'FROM split_shares s JOIN split_expenses e ON e.id = s.expense_id WHERE e.group_id = ?'
      )
      .bind(group.id),
    env.DB
      .prepare(
        'SELECT id, payer, payee, cents, added_by, created_at FROM split_settlements ' +
        'WHERE group_id = ? ORDER BY created_at DESC LIMIT ?'
      )
      .bind(group.id, MAX_ENTRIES)
  ]).then((rows) => rows.map((r) => r.results || []));

  const name = new Map(members.map((m) => [m.id, m.name]));

  const shares = new Map();
  for (const row of shareRows) {
    if (!shares.has(row.expense_id)) shares.set(row.expense_id, []);
    shares.get(row.expense_id).push({ id: row.user_id, cents: row.cents });
  }

  const spends = spendRows.map((row) => ({
    id: row.id,
    what: row.what,
    cents: row.cents,
    payerId: row.payer,
    at: row.created_at,
    /* Whether this browser may take the row out again. Decided here rather
       than on the page: the same rule the write below enforces, said once. */
    mine: row.added_by === user.id || row.payer === user.id,
    shares: shares.get(row.id) || []
  }));

  const payments = paymentRows.map((row) => ({
    id: row.id,
    cents: row.cents,
    payerId: row.payer,
    payeeId: row.payee,
    at: row.created_at,
    mine: row.added_by === user.id || row.payer === user.id || row.payee === user.id
  }));

  const balances = balancesOf(members, spends, payments);

  return {
    id: group.id,
    name: group.name,
    mine: group.owner === user.id,
    members: members.map((m) => ({ name: m.name, you: m.id === user.id })),
    /* Ids stop here. Everything below names people the way the page draws
       them, and an id that is not in the group's own member list — somebody
       who has since left — draws as no name at all rather than as a UUID. */
    spends: spends.map((s) => ({
      id: s.id,
      what: s.what,
      cents: s.cents,
      payer: name.get(s.payerId) || '',
      /* The shares as they were written down, not a total for the page to
         divide again. An equal split of 10.00 between three is 3.34 and two
         of 3.33 — see share() — so a page that divided would print a number
         that is a cent out for one of the three, and the three would not add
         up to what the row says was paid. */
      among: s.shares
        .map((x) => ({ name: name.get(x.id), cents: x.cents }))
        .filter((x) => x.name),
      at: s.at,
      mine: s.mine
    })),
    payments: payments.map((p) => ({
      id: p.id,
      cents: p.cents,
      from: name.get(p.payerId) || '',
      to: name.get(p.payeeId) || '',
      at: p.at,
      mine: p.mine
    })),
    balances: balances,
    settle: settlements(balances)
  };
}

/* ------------------------------------------------------------------ write
 * Everything below needs a session, and everything but `create` and `join`
 * needs the caller to already be in the group it names.
 */
export async function onRequestPost(context) {
  const { request, env } = context;

  if (!env.DB) return json({ error: 'no-database' }, 503);
  /* A preview deployment holding the live database, or the reverse. A group
     made while checking a change must not be a group on the live site. */
  if (await wrongDatabase(env)) return json({ error: 'wrong-database' }, 503);
  if (!env.SAVE_SALT) return json({ error: 'no-salt' }, 503);

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return json({ error: 'malformed' }, 400);
  }

  const user = await sessionUser(request, env);
  if (!user) return json({ error: 'signed-out' }, 401);

  const action = body.action;
  if (action === 'create') return create(context, body, user);
  /* The one action taken on a group you are not yet in — that is what it is
     for — so it is routed above the membership check and does its own. */
  if (action === 'join') return join(context, body, user);

  const group = await groupFor(env, body.group, user);
  if (!group) return json({ error: 'not-found' }, 404);

  if (action === 'spend')    return spend(context, body, user, group);
  if (action === 'unspend')  return unspend(context, body, user, group);
  if (action === 'settle')   return settle(context, body, user, group);
  if (action === 'unsettle') return unsettle(context, body, user, group);
  if (action === 'rename')   return rename(context, body, user, group);
  if (action === 'leave')    return leave(context, user, group);
  if (action === 'remove')   return remove(context, user, group);

  return json({ error: 'action' }, 400);
}

/* How many groups this person is in, which is the cap both create and join
   are held to: a group you were added to costs the same as one you made. */
async function groupsHeld(env, user) {
  const row = await env.DB
    .prepare('SELECT COUNT(*) AS n FROM split_members WHERE user_id = ?')
    .bind(user.id)
    .first();
  return row ? row.n : 0;
}

/* Touched by every write that changes what a group owes, so the front page's
   "the one you were last splitting first" is true. */
function touch(env, groupId, now) {
  return env.DB.prepare('UPDATE split_groups SET updated_at = ? WHERE id = ?').bind(now, groupId);
}

/* A group starts as a name and one member, and the member is whoever named
   it. Everybody else arrives through the link. */
async function create(context, body, user) {
  const { env } = context;

  const name = words(body.name, MAX_NAME);
  if (!name) return json({ error: 'name' }, 400);
  if (await groupsHeld(env, user) >= MAX_GROUPS) return json({ error: 'too-many' }, 429);

  /* Six characters out of an alphabet of twenty-eight on top of the name's
     own stem. The loop is not for the collision — that is one in hundreds of
     millions on the same stem — it is for the primary key being the only
     thing allowed to decide what is unique. */
  const now = Date.now();
  const stem = slugOf(name);
  for (let tries = 0; tries < 5; tries++) {
    const id = stem + '-' + shareCode(CODE_LENGTH);
    try {
      await env.DB.batch([
        env.DB
          .prepare('INSERT INTO split_groups (id, name, owner, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')
          .bind(id, name, user.id, now, now),
        env.DB
          .prepare('INSERT INTO split_members (group_id, user_id, joined_at) VALUES (?, ?, ?)')
          .bind(id, user.id, now)
      ]);
      return json({ id: id, name: name }, 200);
    } catch (e) {
      /* Taken. Round again with a different code. */
    }
  }
  return json({ error: 'busy' }, 503);
}

/* Holding the link is the whole of the permission, which is the same rule a
   shared list is under. There is nothing to approve and nobody to approve it:
   the code is unguessable, and a group whose link has got out is a group to
   remake rather than a moderation queue to build. */
async function join(context, body, user) {
  const { env } = context;

  const id = String(typeof body.group === 'string' ? body.group : '');
  if (!GROUP_ID.test(id)) return json({ error: 'not-found' }, 404);

  const group = await env.DB
    .prepare('SELECT id, name FROM split_groups WHERE id = ?')
    .bind(id)
    .first();
  if (!group) return json({ error: 'not-found' }, 404);

  const members = await membersOf(env, id);
  /* Already in it. Not an error — this is what opening the link a second time
     does, and the page it lands on is the group either way. */
  if (members.some((m) => m.id === user.id)) return json({ id: id, name: group.name }, 200);

  if (members.length >= MAX_MEMBERS) return json({ error: 'full' }, 429);
  if (await groupsHeld(env, user) >= MAX_GROUPS) return json({ error: 'too-many' }, 429);

  await env.DB
    .prepare('INSERT OR IGNORE INTO split_members (group_id, user_id, joined_at) VALUES (?, ?, ?)')
    .bind(id, user.id, Date.now())
    .run();

  return json({ id: id, name: group.name }, 200);
}

/* ---------------------------------------------------------------- an expense
 * What somebody paid, and who it was for. The payer is not necessarily the
 * person typing: one phone comes out at the end of the meal and puts in what
 * everybody paid, which is the only way this ever gets filled in at all.
 */
async function spend(context, body, user, group) {
  const { env } = context;

  const what = words(body.what, MAX_WHAT);
  if (!what) return json({ error: 'what' }, 400);

  const cents = body.cents;
  if (!Number.isInteger(cents) || cents < 1 || cents > MAX_CENTS) {
    return json({ error: 'amount' }, 400);
  }

  const members = await membersOf(env, group.id);
  /* Unsaid means the person typing, which is the common case and saves the
     page sending its own name back to be told who it is. */
  const payer = body.payer === undefined ? members.find((m) => m.id === user.id)
                                         : memberByName(members, body.payer);
  if (!payer) return json({ error: 'payer' }, 400);

  /* Unsaid means everybody, which is what splitting a bill means. A list that
     names somebody who is not in this group is refused rather than quietly
     narrowed — a share nobody can pay is worse than a rejected form. */
  let among = members;
  if (body.among !== undefined) {
    if (!Array.isArray(body.among) || !body.among.length) return json({ error: 'among' }, 400);
    among = [];
    for (const name of body.among) {
      const m = memberByName(members, name);
      if (!m) return json({ error: 'among' }, 400);
      if (!among.some((x) => x.id === m.id)) among.push(m);
    }
    /* Back into the group's own order, so the remainder cent in share() falls
       the same way whatever order the page sent the names in. */
    among = members.filter((m) => among.some((x) => x.id === m.id));
  }

  const held = await env.DB
    .prepare('SELECT COUNT(*) AS n FROM split_expenses WHERE group_id = ?')
    .bind(group.id)
    .first();
  if (held && held.n >= MAX_ENTRIES) return json({ error: 'too-many' }, 429);

  const id = entryId();
  const now = Date.now();
  const statements = [
    env.DB
      .prepare(
        'INSERT INTO split_expenses (id, group_id, payer, what, cents, added_by, created_at) ' +
        'VALUES (?, ?, ?, ?, ?, ?, ?)'
      )
      .bind(id, group.id, payer.id, what, cents, user.id, now)
  ];
  for (const part of share(cents, among)) {
    statements.push(
      env.DB
        .prepare('INSERT INTO split_shares (expense_id, user_id, cents) VALUES (?, ?, ?)')
        .bind(id, part.id, part.cents)
    );
  }
  statements.push(touch(env, group.id, now));

  /* One transaction: an expense whose shares did not all land would be a
     total that no longer equals the sum of its parts, which is the one thing
     the arithmetic here cannot survive. */
  await env.DB.batch(statements);

  return json({ group: await readGroup(env, group, user) }, 200);
}

/* Taking a line back off. Whoever typed it and whoever paid it, and nobody
   else: a group is a room of friends, not a wiki, and somebody's card being
   named is enough of a claim on the row to remove it. */
async function unspend(context, body, user, group) {
  const { env } = context;

  const id = String(typeof body.id === 'string' ? body.id : '');
  if (!ENTRY_ID.test(id)) return json({ error: 'not-found' }, 404);

  const row = await env.DB
    .prepare('SELECT payer, added_by FROM split_expenses WHERE id = ? AND group_id = ?')
    .bind(id, group.id)
    .first();
  if (!row) return json({ error: 'not-found' }, 404);
  if (row.added_by !== user.id && row.payer !== user.id) return json({ error: 'not-yours' }, 403);

  await env.DB.batch([
    env.DB.prepare('DELETE FROM split_shares WHERE expense_id = ?').bind(id),
    env.DB.prepare('DELETE FROM split_expenses WHERE id = ? AND group_id = ?').bind(id, group.id),
    touch(env, group.id, Date.now())
  ]);

  return json({ group: await readGroup(env, group, user) }, 200);
}

/* ---------------------------------------------------------------- a payment
 * Money that actually moved. Any member may record one, because the page
 * offers it on each of the suggested payments and the person pressing it is
 * as likely to be the one who received the money as the one who sent it.
 */
async function settle(context, body, user, group) {
  const { env } = context;

  const cents = body.cents;
  if (!Number.isInteger(cents) || cents < 1 || cents > MAX_CENTS) {
    return json({ error: 'amount' }, 400);
  }

  const members = await membersOf(env, group.id);
  const from = body.from === undefined ? members.find((m) => m.id === user.id)
                                       : memberByName(members, body.from);
  const to = memberByName(members, body.to);
  if (!from || !to || from.id === to.id) return json({ error: 'who' }, 400);

  const held = await env.DB
    .prepare('SELECT COUNT(*) AS n FROM split_settlements WHERE group_id = ?')
    .bind(group.id)
    .first();
  if (held && held.n >= MAX_ENTRIES) return json({ error: 'too-many' }, 429);

  const now = Date.now();
  await env.DB.batch([
    env.DB
      .prepare(
        'INSERT INTO split_settlements (id, group_id, payer, payee, cents, added_by, created_at) ' +
        'VALUES (?, ?, ?, ?, ?, ?, ?)'
      )
      .bind(entryId(), group.id, from.id, to.id, cents, user.id, now),
    touch(env, group.id, now)
  ]);

  return json({ group: await readGroup(env, group, user) }, 200);
}

/* Either end of the payment, and whoever wrote it down. */
async function unsettle(context, body, user, group) {
  const { env } = context;

  const id = String(typeof body.id === 'string' ? body.id : '');
  if (!ENTRY_ID.test(id)) return json({ error: 'not-found' }, 404);

  const row = await env.DB
    .prepare('SELECT payer, payee, added_by FROM split_settlements WHERE id = ? AND group_id = ?')
    .bind(id, group.id)
    .first();
  if (!row) return json({ error: 'not-found' }, 404);
  if (row.added_by !== user.id && row.payer !== user.id && row.payee !== user.id) {
    return json({ error: 'not-yours' }, 403);
  }

  await env.DB.batch([
    env.DB.prepare('DELETE FROM split_settlements WHERE id = ? AND group_id = ?').bind(id, group.id),
    touch(env, group.id, Date.now())
  ]);

  return json({ group: await readGroup(env, group, user) }, 200);
}

/* The name is the owner's to change. Everything else about a group belongs to
   whoever paid for it. */
async function rename(context, body, user, group) {
  const { env } = context;
  if (group.owner !== user.id) return json({ error: 'not-yours' }, 403);

  const name = words(body.name, MAX_NAME);
  if (!name) return json({ error: 'name' }, 400);

  await env.DB
    .prepare('UPDATE split_groups SET name = ?, updated_at = ? WHERE id = ?')
    .bind(name, Date.now(), group.id)
    .run();

  return json({ id: group.id, name: name }, 200);
}

/* Leaving is for the person who joined the wrong link, and that is all it is
 * for. The moment somebody appears in the arithmetic — as a payer, as a share
 * of somebody else's bill, at either end of a payment — leaving would take
 * their name out of a column that still counts their cents, and the group
 * would read as one that no longer balances. So it is refused, and the way
 * out of a group you have spent in is for its owner to take the whole thing
 * down.
 *
 * The owner cannot leave at all: the group's own row names them.
 */
async function leave(context, user, group) {
  const { env } = context;
  if (group.owner === user.id) return json({ error: 'owner' }, 403);

  const held = await env.DB
    .prepare(
      'SELECT (SELECT COUNT(*) FROM split_expenses WHERE group_id = ?1 AND payer = ?2) + ' +
      '(SELECT COUNT(*) FROM split_shares s JOIN split_expenses e ON e.id = s.expense_id ' +
      ' WHERE e.group_id = ?1 AND s.user_id = ?2) + ' +
      '(SELECT COUNT(*) FROM split_settlements WHERE group_id = ?1 AND (payer = ?2 OR payee = ?2)) AS n'
    )
    .bind(group.id, user.id)
    .first();
  if (held && held.n > 0) return json({ error: 'spent' }, 409);

  await env.DB
    .prepare('DELETE FROM split_members WHERE group_id = ? AND user_id = ?')
    .bind(group.id, user.id)
    .run();

  return json({ left: true }, 200);
}

/* The whole group, and everything in it. The owner's, and only theirs.
 *
 * There is no archive and no undo. What it is deleting is a dinner from three
 * weeks ago that everybody has settled, and keeping a tombstone of who owed
 * whom what would be the one thing nobody wants kept.
 */
async function remove(context, user, group) {
  const { env } = context;
  if (group.owner !== user.id) return json({ error: 'not-yours' }, 403);

  await env.DB.batch([
    env.DB
      .prepare('DELETE FROM split_shares WHERE expense_id IN (SELECT id FROM split_expenses WHERE group_id = ?)')
      .bind(group.id),
    env.DB.prepare('DELETE FROM split_expenses WHERE group_id = ?').bind(group.id),
    env.DB.prepare('DELETE FROM split_settlements WHERE group_id = ?').bind(group.id),
    env.DB.prepare('DELETE FROM split_members WHERE group_id = ?').bind(group.id),
    env.DB.prepare('DELETE FROM split_groups WHERE id = ?').bind(group.id)
  ]);

  return json({ removed: true }, 200);
}
