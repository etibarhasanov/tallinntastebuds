/**
 * Tallinn Tastebuds — keeping google_venues current, one opened place at a time.
 *
 * The directory's eleven hundred rows came out of one sweep of Google in
 * September 2026, and a review count is the kind of number that is wrong a
 * month later. This is what keeps them from going stale without anybody
 * re-running that sweep: when somebody opens a place whose Google numbers the
 * site prints — one of Google's places, on the map or as a card on /admin/google, or
 * one of mine that the export also lists, whose panel carries "According to
 * Google" — and its row has not been refreshed for REFRESH_AFTER, the place is
 * asked about again and the answer written back.
 *
 * WHY ON OPEN, AND NOT ON A SCHEDULE
 *
 * Because the open is the signal. The places people look at are the ones whose
 * numbers somebody is reading, so they are the ones worth keeping true, and a
 * place nobody opens costs nothing. A queue ordered by press_counts would work
 * out the same order the long way round; this is that order without the queue,
 * without a cron, and without a second thing to deploy. It rides on the one
 * request that already happens at that moment — the POST that counts the open,
 * in functions/api/stats.js — and runs after that answer has gone out, through
 * waitUntil, so nobody ever waits on Google. The visitor who triggers a refresh
 * sees the row as it was; the next one sees it fresh.
 *
 * WHAT IS ASKED FOR, AND WHAT IT COSTS
 *
 * Place Details (New), one place per call, with FIELDS as the mask: the seven
 * columns that actually move — rating, review count, open or closed, price,
 * phone, website, the week's hours. Not the name, the address, the category or
 * the coordinates: they change rarely, the cuisine is derived from them, and
 * leaving them out keeps this a mirror of the numbers rather than a second
 * source for the description.
 *
 * `rating` and `userRatingCount` are Enterprise fields, so every call bills as
 * Place Details Enterprise, which Google gives a thousand of free a month per
 * billing account. The rest of the mask rides on that price. The free
 * allowance is the budget, and it is enforced here rather than in the Google
 * Cloud console, because the console will not lower a quota on every kind of
 * account: BUDGET says how many calls a day and a month, and spend() claims one
 * in the database before any request leaves. The monthly figure sits under a
 * thousand on purpose — Google's month turns over on Pacific time and this
 * counter's on UTC, so the two do not start at the same instant.
 *
 * The key is GOOGLE_MAPS_API_KEY, a secret in the Pages dashboard. Set it for
 * Production only: the counter lives in whichever database the site is bound
 * to, so a key in Preview too would be a second counter spending from the same
 * free thousand. Without it, nothing here runs and the site is exactly what it
 * was — see **Keeping it current** under **Google venues** in README.md.
 *
 * WHAT IS WRITTEN
 *
 *   google_venues     the seven columns, and refreshed_at. A place Google says
 *                     has closed for good, or no longer knows at all, gets
 *                     missing_since instead — never deleted, because a list may
 *                     point at it — and a missing place that answers as open
 *                     again is cleared.
 *   google_calls      one row per UTC day and kind of call, counting up.
 *   google_refreshes  one row per call, saying what came back and what moved.
 *                     It is what the Google tab on /admin.html reads, through
 *                     /api/admin/refreshes, and it keeps ninety days.
 *   google_scores     the rating and review count of every answer, kept for
 *                     good, with the pair the row had before the first one —
 *                     so a place's numbers are a series rather than whatever
 *                     the last answer said. See keepScores().
 *
 * `rank` is not recomputed here. It is every row's position among all of
 * them, so one row's new count cannot place it without re-reading the rest;
 * /admin/google sorts by its own copy of that arithmetic in the browser, so the
 * order on the page follows the new numbers at once and only the printed
 * position waits.
 *
 * Every step is quiet. A missing table, a missing column, a refused key and a
 * Google outage all end the same way: the row stays as it was and the page
 * never hears about it.
 */

/* How old a row's numbers may get before an open asks Google again. A month,
   because that is the horizon Google's terms put on keeping its content, and
   because a review count that is a month old is still a fair description of
   how established a place is. */
export const REFRESH_AFTER = 30 * 24 * 60 * 60 * 1000;

/* The spending limit, per kind of call. `details` is Place Details Enterprise,
   a thousand free a month: thirty-two a day is at most 992 in a thirty-one-day
   month, and the monthly cap under it catches whatever the daily one does not.
   Anything that calls Google claims from here first — see spend(). */
export const BUDGET = {
  details: { day: 32, month: 950 }
};

/* Ninety days of the log, which is three full rounds of REFRESH_AFTER — long
   enough to see a place come round again, short enough that the table is a few
   thousand rows at most. */
const KEEP_LOG = 90 * 24 * 60 * 60 * 1000;

const DETAILS = 'https://places.googleapis.com/v1/places/';

/* The mask. Every field but the id maps onto one column below, and nothing is
   asked for that is not written. */
const FIELDS = [
  'id', 'rating', 'userRatingCount', 'businessStatus', 'priceLevel',
  'internationalPhoneNumber', 'websiteUri', 'regularOpeningHours'
].join(',');

/* The columns a refresh may change, in the order the log reports them. */
const MOVING = ['rating', 'reviews', 'status', 'price', 'phone', 'website', 'opening_hours'];

/* Google's price levels, as the export spelled them: "$" to "$$$$", the scale
   the table has always held verbatim. FREE and UNSPECIFIED say nothing a band
   can carry, so they count as Google not saying, and the row keeps its own. */
const PRICES = {
  PRICE_LEVEL_INEXPENSIVE: '$',
  PRICE_LEVEL_MODERATE: '$$',
  PRICE_LEVEL_EXPENSIVE: '$$$',
  PRICE_LEVEL_VERY_EXPENSIVE: '$$$$'
};

/* Google's day numbers start on Sunday; the column starts on Monday, the way
   venueHours() in _lib.js reads it. */
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WEEK = [1, 2, 3, 4, 5, 6, 0];

/* The key, when there is a usable one. Trimmed, because a value pasted into
   the dashboard with a newline on the end is the commonest way for a secret to
   be present and wrong; and held to the shape Google's keys have, so a stray
   word in the box reads as absent rather than as thirty-two refused calls a
   day. */
export function googleKey(env) {
  const key = String((env && env.GOOGLE_MAPS_API_KEY) || '').trim();
  return /^[A-Za-z0-9_-]{30,64}$/.test(key) ? key : '';
}

/* ------------------------------------------------------------------- budget */

function dayOf(now) {
  return new Date(now).toISOString().slice(0, 10);
}

/* Claims one call of `kind` against BUDGET, and says whether it got one.
 *
 * One statement, so two opens in the same instant cannot both take the last
 * call of the day: the insert makes today's row where there is none, the
 * update adds one where there is, and each only happens while today's count
 * and the month's total are both under their limits. RETURNING hands back a
 * row only when one of them did. The SELECT carries a WHERE of its own because
 * SQLite needs one to tell an upsert's ON CONFLICT from a join's ON.
 *
 * A claim is spent whether or not the call then succeeds. Google does not bill
 * a refused call, so this can undercount what is free by the odd failure; it
 * can never overcount what is billed, which is the direction that matters. */
async function spend(env, kind, now) {
  const limit = BUDGET[kind];
  if (!limit) return false;
  const day = dayOf(now);
  const month = day.slice(0, 8) + '01';

  const row = await env.DB
    .prepare(
      'INSERT INTO google_calls (day, kind, n) ' +
      'SELECT ?1, ?2, 1 ' +
      'WHERE (SELECT COALESCE(SUM(n), 0) FROM google_calls WHERE kind = ?2 AND day >= ?3) < ?5 ' +
      'ON CONFLICT(day, kind) DO UPDATE SET n = n + 1 ' +
      'WHERE n < ?4 ' +
      'AND (SELECT COALESCE(SUM(n), 0) FROM google_calls WHERE kind = ?2 AND day >= ?3) < ?5 ' +
      'RETURNING n'
    )
    .bind(day, kind, month, limit.day, limit.month)
    .first();
  return !!row;
}

/* What has been spent, for the report: today's calls and the month's. */
export async function spent(env, kind, now) {
  const day = dayOf(now);
  const month = day.slice(0, 8) + '01';
  const row = await env.DB
    .prepare(
      'SELECT ' +
      'COALESCE(SUM(CASE WHEN day = ?2 THEN n END), 0) AS today, ' +
      'COALESCE(SUM(n), 0) AS month ' +
      'FROM google_calls WHERE kind = ?1 AND day >= ?3'
    )
    .bind(kind, day, month)
    .first();
  return { today: Number(row && row.today) || 0, month: Number(row && row.month) || 0 };
}

/* ------------------------------------------------------ Google into columns */

function two(n) {
  return (n < 10 ? '0' : '') + n;
}

function clock(point) {
  return two(Number(point.hour) || 0) + ':' + two(Number(point.minute) || 0);
}

/* The week, in the one-line form the column has always held:
 *
 *   "Mon 12:00-20:00; Tue 12:00-15:00, 17:00-22:00; ...; Sun closed"
 *
 * built from Google's `periods` rather than its `weekdayDescriptions`. The
 * descriptions are the twelve-hour, narrow-space text exports/clean_restaurants_csv.py
 * had to take apart; the periods are numbers, so the same string comes out
 * directly. The same conventions as that cleaner, because venueHours() in
 * _lib.js reads what both write:
 *
 *   - Monday first, every day named, a day with nothing in it "closed";
 *   - two sittings on one day joined by ", ";
 *   - a close after midnight written as the earlier clock time it is
 *     ("18:00-02:00"), filed under the day it opened;
 *   - open around the clock as "00:00-24:00" on every day. Google says that
 *     with a single period that opens Sunday at midnight and has no close.
 *
 * No `regularOpeningHours` at all is Google not saying, which is different
 * from a place that is shut every day: it comes out empty rather than as seven
 * closed days, and fromGoogle() keeps the week the row already had. */
function weekOf(hours) {
  const periods = hours && Array.isArray(hours.periods) ? hours.periods : null;
  if (!periods || !periods.length) return '';

  const spans = [[], [], [], [], [], [], []];
  for (const period of periods) {
    const open = period && period.open;
    if (!open || !Number.isInteger(open.day) || open.day < 0 || open.day > 6) continue;
    if (!period.close) {
      if (periods.length === 1) return WEEK.map((d) => DAY_NAMES[d] + ' 00:00-24:00').join('; ');
      continue;
    }
    spans[open.day].push({
      at: (Number(open.hour) || 0) * 60 + (Number(open.minute) || 0),
      text: clock(open) + '-' + clock(period.close)
    });
  }

  return WEEK.map((d) => {
    const today = spans[d].sort((a, b) => a.at - b.at);
    return DAY_NAMES[d] + ' ' + (today.length ? today.map((s) => s.text).join(', ') : 'closed');
  }).join('; ');
}

/* The seven columns out of one Details answer, plus whether the answer says
 * the place has closed for good.
 *
 * A field Google sends overwrites the column. A field it leaves out keeps what
 * the row already had. Google omits a field for two reasons that look the same
 * from here — the place no longer has one, or this answer simply did not carry
 * it — and the costs are lopsided: keeping a website a place has since taken
 * down leaves one dead link until somebody notices, while blanking on every
 * omission would let one thin answer wipe a good phone number and a week of
 * hours with nobody watching. This writes unattended, so it takes the side
 * that cannot destroy anything. The log says what moved, so a column that
 * should have emptied and did not is findable. */
function fromGoogle(place, before) {
  const out = {
    rating: Number.isFinite(place.rating) ? place.rating : before.rating,
    reviews: Number.isInteger(place.userRatingCount) ? place.userRatingCount : before.reviews,
    status: before.status,
    price: PRICES[place.priceLevel] || before.price,
    phone: typeof place.internationalPhoneNumber === 'string' && place.internationalPhoneNumber.trim()
      ? place.internationalPhoneNumber.trim() : before.phone,
    website: typeof place.websiteUri === 'string' && place.websiteUri.trim()
      ? place.websiteUri.trim() : before.website,
    opening_hours: weekOf(place.regularOpeningHours) || before.opening_hours
  };

  const said = place.businessStatus;
  if (said === 'OPERATIONAL') out.status = 'Open';
  /* A place that has not opened yet is, to somebody standing at the door,
     closed for now; the export filed everything that was not OPERATIONAL the
     same way. */
  else if (said === 'CLOSED_TEMPORARILY' || said === 'FUTURE_OPENING') out.status = 'Temporarily closed';

  return { row: out, closedForGood: said === 'CLOSED_PERMANENTLY' };
}

/* Which columns moved, as { column: [from, to] }. Numbers compared as numbers,
   so a REAL that comes back 4.5 against a stored 4.5 is not a change. */
function changesBetween(before, after) {
  const moved = {};
  for (const column of MOVING) {
    const a = before[column] === undefined ? null : before[column];
    const b = after[column] === undefined ? null : after[column];
    const same = (typeof a === 'number' || typeof b === 'number')
      ? (a === null && b === null) || (a !== null && b !== null && Number(a) === Number(b))
      : String(a === null ? '' : a) === String(b === null ? '' : b);
    if (!same) moved[column] = [a, b];
  }
  return moved;
}

/* ------------------------------------------------------------------ refresh */

/* The numbers an answer carried, added to google_scores rather than written
   over, so how a place's review count and rating moved can be read later.
   Every answer is kept, a count that did not move included: a flat month is
   part of the series, and without it a gap and a standstill look the same.

   The first answer for a place also keeps what the row said before it — the
   export's pair, or a refresh from before this table existed — in the same
   batch and only while the place has no line yet, so the series starts where
   the site's knowledge of the place does rather than at the first open.

   Quiet, like everything else here: without the table the refresh has already
   been written, and only the history misses a point. */
async function keepScores(env, placeId, before, after, at, was) {
  try {
    await env.DB.batch([
      env.DB
        .prepare(
          'INSERT INTO google_scores (place_id, at, rating, reviews, source) ' +
          'SELECT ?1, ?2, ?3, ?4, ?5 ' +
          'WHERE NOT EXISTS (SELECT 1 FROM google_scores WHERE place_id = ?1)'
        )
        .bind(placeId, was, before.rating === undefined ? null : before.rating,
          before.reviews === undefined ? null : before.reviews, was === null ? 'export' : 'open'),
      env.DB
        .prepare('INSERT INTO google_scores (place_id, at, rating, reviews, source) VALUES (?, ?, ?, ?, ?)')
        .bind(placeId, at, after.rating, after.reviews, 'open')
    ]);
  } catch (e) {
    /* google_scores not applied to this database yet. */
  }
}

/* One line of the log, and the prune that keeps it to KEEP_LOG, in one round
   trip. `changes` is { column: [from, to] } or nothing; `note` is a sentence
   for the outcomes a column cannot explain — a refusal, a closure, a place
   Google no longer knows. */
async function log(env, now, id, outcome, changes, note) {
  await env.DB.batch([
    env.DB
      .prepare(
        'INSERT INTO google_refreshes (at, place_id, source, outcome, changes, note) ' +
        'VALUES (?, ?, ?, ?, ?, ?)'
      )
      .bind(now, id, 'open', outcome, changes ? JSON.stringify(changes) : '', note || ''),
    env.DB
      .prepare('DELETE FROM google_refreshes WHERE at < ?')
      .bind(now - KEEP_LOG)
  ]);
}

/* The whole of it, for one place somebody has just opened. Called from
 * functions/api/stats.js through waitUntil, with an id that route has already
 * checked is real — either kind of id, because both kinds of place now show
 * Google's numbers. Never throws. The word it answers with names the exit it
 * took; nothing on the site reads it, and it is what a console.log under
 * `wrangler pages dev` would want. */
export async function refreshOnOpen(env, id) {
  const at = Date.now();
  const key = googleKey(env);
  if (!key || !env || !env.DB) return 'no-key';

  /* A Google key names its row. A place of mine is a lowercase slug, and
     sixty-two of them are also rows of the export, joined by map_id, whose
     numbers the panel on the map prints under "According to Google" — so
     opening one of those is as good a reason to ask as opening the row
     itself. Found the way /api/venues?map= finds the row that panel draws,
     so the row refreshed is the row shown; a place of mine Google does not
     list finds nothing and stops here. */
  const google = /[A-Z]/.test(id);
  let before;
  try {
    before = await env.DB
      .prepare(
        'SELECT place_id, rating, reviews, status, price, phone, website, opening_hours, ' +
        'refreshed_at, hidden FROM google_venues ' +
        (google
          ? 'WHERE place_id = ?'
          : 'WHERE map_id = ? AND hidden = 0 AND missing_since IS NULL LIMIT 1')
      )
      .bind(id)
      .first();
  } catch (e) {
    /* refreshed_at not applied to this database yet. */
    return 'not-ready';
  }
  if (!before || before.hidden) return 'not-a-venue';
  const placeId = before.place_id;
  const was = before.refreshed_at === undefined ? null : before.refreshed_at;
  if ((Number(was) || 0) > at - REFRESH_AFTER) return 'fresh';

  /* The row first, and the budget second. Stamping the row is what stops two
     visitors opening the same place in the same second from paying for it
     twice: only one UPDATE still finds it due. */
  try {
    const claimed = await env.DB
      .prepare(
        'UPDATE google_venues SET refreshed_at = ?1 ' +
        'WHERE place_id = ?2 AND COALESCE(refreshed_at, 0) <= ?3'
      )
      .bind(at, placeId, at - REFRESH_AFTER)
      .run();
    if (!claimed || !claimed.meta || claimed.meta.changes !== 1) return 'taken';
  } catch (e) {
    return 'error';
  }

  /* Everything after the claim either writes the answer or gives the claim
     back — out of budget, Google refusing, a table not applied — so the next
     open tries again rather than the row reading as fresh for a month on the
     strength of nothing. Only a stamp that is still this attempt's own is put
     back. */
  let written = false;
  const unclaim = () => env.DB
    .prepare('UPDATE google_venues SET refreshed_at = ? WHERE place_id = ? AND refreshed_at = ?')
    .bind(was, placeId, at)
    .run();

  try {
    if (!(await spend(env, 'details', at))) {
      await unclaim();
      return 'spent';
    }

    let res;
    try {
      res = await fetch(DETAILS + encodeURIComponent(placeId), {
        headers: { 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': FIELDS }
      });
    } catch (e) {
      await unclaim();
      await log(env, at, placeId, 'failed', null, 'no answer from Google');
      return 'failed';
    }

    /* Google no longer knows the id: the place was removed, or merged into
       another. It leaves the directory the way a place that left the export
       did, and stays readable for a list that points at it. */
    if (res.status === 404) {
      await env.DB
        .prepare('UPDATE google_venues SET missing_since = COALESCE(missing_since, ?) WHERE place_id = ?')
        .bind(at, placeId)
        .run();
      written = true;
      await log(env, at, placeId, 'gone', null, 'Google does not know this place any more');
      return 'gone';
    }

    /* A refused key answers 403 with a sentence saying why, and that sentence
       is the one thing worth putting in front of whoever reads the log. */
    if (!res.ok) {
      let why = 'HTTP ' + res.status;
      try {
        const body = await res.json();
        if (body && body.error && body.error.message) why += ': ' + String(body.error.message).slice(0, 200);
      } catch (e) { /* not JSON, and the status says enough */ }
      await unclaim();
      await log(env, at, placeId, 'failed', null, why);
      return 'failed';
    }

    const place = (await res.json()) || {};
    const { row, closedForGood } = fromGoogle(place, before);
    const moved = changesBetween(before, row);

    await env.DB
      .prepare(
        'UPDATE google_venues SET rating = ?, reviews = ?, status = ?, price = ?, phone = ?, ' +
        'website = ?, opening_hours = ?, refreshed_at = ?, ' +
        'missing_since = CASE WHEN ? THEN COALESCE(missing_since, ?) ELSE NULL END ' +
        'WHERE place_id = ?'
      )
      .bind(row.rating, row.reviews, row.status, row.price, row.phone,
        row.website, row.opening_hours, at, closedForGood ? 1 : 0, at, placeId)
      .run();
    written = true;
    await keepScores(env, placeId, before, row, at, was);

    const any = Object.keys(moved).length > 0;
    const outcome = closedForGood ? 'closed' : any ? 'changed' : 'same';
    await log(env, at, placeId, outcome, any ? moved : null,
      closedForGood ? 'Google says it has closed for good' : '');
    return outcome;
  } catch (e) {
    if (!written) {
      try { await unclaim(); } catch (ignored) { /* the database is the thing that failed */ }
    }
    return 'error';
  }
}
