/**
 * Tallinn Tastebuds — the chat box on the map, answered.
 *
 * POST /api/ask   { q, lang }  ->  { ok, source, picks, say, open }
 *
 * Somebody types "somewhere cheap and asian, still open" into the map and this
 * turns it into two or three places off my own list, each with a line saying
 * why. It is the only route here that calls a language model, and the only one
 * that is allowed to answer with nothing and still be working correctly.
 *
 * WHAT IT IS ALLOWED TO SAY, AND WHY THAT IS THE WHOLE DESIGN
 *
 * The model never writes about a place. It picks ids out of a list it is
 * given and writes one clause about each; the browser then draws the card
 * from data/restaurants.json exactly as it draws every other card on the site.
 * So the price, the dish, the write-up and the photographs on screen are mine
 * whatever the model said, and an id it invented is dropped here rather than
 * rendered as a restaurant that does not exist. A hallucinated sentence about
 * a real place is a bad recommendation; a hallucinated place is a lie the site
 * told in its own voice, and this shape makes the second one unreachable.
 *
 * TWO ROLLS, AND ONLY ONE OF THEM IS RECOMMENDED FROM
 *
 * This site has two lists of places and the difference is the point — see the
 * header of /api/venues. The seventy-five in data/restaurants.json are places
 * I have been to and written up; the eleven hundred in `google_venues` are
 * Google's description of the city. A recommendation comes off the first,
 * always: being on my map is the verdict, and a chat box that started
 * suggesting places I have never eaten in would be a different site.
 *
 * Google's roll is read here for exactly one thing, opening hours, joined on
 * `google_venues.map_id` — the column that says which Google row is which of
 * my places. Sixty of my seventy-five have one. The other fifteen simply have
 * no hours, and an answer about them says nothing about hours rather than
 * guessing.
 *
 * IT IS FREE, AND WHAT HAPPENS WHEN IT STOPS BEING
 *
 * Workers AI gives every account ten thousand Neurons a day at no charge. This
 * asks for a few hundred tokens a question against a small model, so the
 * allowance is a lot of questions — and on the Workers Free plan going past it
 * fails the request rather than billing for it, which is the rate limit and
 * the budget in one. There is nothing to configure, no key, and no npm.
 *
 * Every way this can fail — no binding, allowance spent, model overloaded,
 * unparseable answer, every id invented — comes back as `source: "none"` with
 * the hours still in it and a 200, because assets/ask.js in the browser can
 * read the question by itself and the map should never sit there apologising.
 * The chat gets less clever for the rest of the day; it does not break.
 */

import { json, mapPlaces, venueHours, wrongDatabase } from './_lib.js';

/* A model that is on the Workers Free plan. Cloudflare has moved the
   larger ones behind Workers Paid before now — @cf/moonshotai/kimi-k2.6 and
   @cf/zai-org/glm-5.2 went that way in July 2026 — so the one named here is
   deliberately from the list that stayed free, and changing it is this line.
   A model that has been moved answers 403 and is handled like any other
   failure below: the browser reads the question itself. */
const MODEL = '@cf/google/gemma-4-26b-a4b-it';

/* Long enough for a real sentence in any of the ten languages, short enough
   that nothing anybody pastes in decides what this costs to run.

   The same number is in assets/ask.js, which is where the browser reads it
   from, and again as the field's maxlength in index.html. It is repeated here
   rather than shared because it is the only one of the three that binds:
   nothing a browser sends can be trusted to have obeyed either of the others. */
const MAX_QUESTION = 200;

/* What the browser draws, and so what the model is asked for. Three is what a
   person reads before deciding; the map is already there for the other
   seventy-two. */
const MAX_PICKS = 3;

/* The blurb is the only long field in the catalogue the model sees, and the
   first sentence or so of one is enough to choose on. Sending all of them
   whole would be a hundred and eighty kilobytes of prompt for an answer that
   names three places. */
const BLURB_CHARS = 150;

const SCHEMA = {
  type: 'object',
  properties: {
    say: { type: 'string' },
    picks: {
      type: 'array',
      items: {
        type: 'object',
        properties: { id: { type: 'string' }, why: { type: 'string' } },
        required: ['id', 'why']
      }
    }
  },
  required: ['picks']
};

/* ----------------------------------------------------------------- hours
 * Which of my places are open in Tallinn at this moment, and until when.
 *
 * The clock is the city's and never the reader's, for the reason
 * assets/venues.js gives at length where it asks the same question in the
 * browser: the hours are a fact about a door in Tallinn, and somebody
 * planning tonight from Lisbon is asking about that door. This is the second
 * copy of that reading of the clock and the second of a day's spans, because
 * the browser cannot import from a Function and a Function cannot import from
 * assets/ — the same standing exception the story clock has between
 * assets/app.js and tools/clock.mjs. Change one, look at the other.
 *
 * What is not copied is the parsing of Google's column: venueHours() in
 * _lib.js is the one parser of that, here as everywhere else.
 */
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function tallinnNow() {
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Tallinn',
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).formatToParts(new Date());

    const said = {};
    for (const part of parts) said[part.type] = part.value;
    const day = DAYS.indexOf(said.weekday);
    if (day !== -1) {
      return { day, minute: (Number(said.hour) % 24) * 60 + Number(said.minute) };
    }
  } catch (e) { /* no zone data: the runtime's own clock is UTC, close enough */ }

  const now = new Date();
  return { day: (now.getUTCDay() + 6) % 7, minute: now.getUTCHours() * 60 + now.getUTCMinutes() };
}

/* One day of Google's week — "11:00-22:00", or "12:00-15:00, 17:00-22:00"
   where the kitchen shuts in the afternoon — as pairs of minutes past
   midnight. A closing time at or before the opening one has gone past
   midnight, so it gets the next day's minutes added to it: "18:00-01:00" is
   1080 to 1500 rather than 1080 to 60, which would be a span of nothing. */
function spansOf(day) {
  const out = [];
  if (!day) return out;

  for (const chunk of String(day).split(',')) {
    const m = /(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/.exec(chunk);
    if (!m) continue;
    const from = Number(m[1]) * 60 + Number(m[2]);
    let to = Number(m[3]) * 60 + Number(m[4]);
    if (to <= from) to += 24 * 60;
    out.push([from, to, m[3].padStart(2, '0') + ':' + m[4]]);
  }

  return out;
}

/* Open at this minute, and the time it shuts — or nothing at all. Yesterday's
   week-day is asked as well as today's, because a place that opened at six
   last night and shuts at one this morning is open now and says so on
   yesterday's row. */
function openUntil(week, now) {
  if (!Array.isArray(week) || week.length !== 7) return '';

  const yesterday = (now.day + 6) % 7;
  const runs = [
    [spansOf(week[now.day]), now.minute],
    [spansOf(week[yesterday]), now.minute + 24 * 60]
  ];

  for (const [spans, minute] of runs) {
    for (const [from, to, shuts] of spans) {
      if (minute >= from && minute < to) return shuts;
    }
  }

  return '';
}

/* My places that are open right now, as id -> the time it shuts.
 *
 * One statement with no parameters and sixty rows back: every Google row that
 * has been linked to a place of mine. It is not venuesByIds() in _lib.js,
 * which goes the other way — a handful of Google keys in, their whole entries
 * out — and asking it this question would mean knowing the Google key for each
 * of my places before asking, which is the thing this join exists to answer.
 *
 * A database that is missing, wrong or simply has nothing linked yet gives an
 * empty answer, and every caller of this reads that as "no hours known" rather
 * than as "nothing is open".
 */
async function openPlaces(env) {
  if (!env.DB) return {};

  let rows = [];
  try {
    const out = await env.DB
      .prepare(
        'SELECT map_id, opening_hours FROM google_venues ' +
        "WHERE map_id IS NOT NULL AND opening_hours != '' AND status = 'Open'"
      )
      .all();
    rows = out.results || [];
  } catch (e) {
    return {};
  }

  const now = tallinnNow();
  const open = {};

  for (const row of rows) {
    const shuts = openUntil(venueHours(row.opening_hours), now);
    if (shuts) open[row.map_id] = shuts;
  }

  return open;
}

/* --------------------------------------------------------------- the ask
 * The catalogue as the model reads it: one line a place, pipe separated, in
 * the reader's own language wherever the data has it.
 *
 * The blurb is the reading language's rather than English, and that is not
 * politeness — it is what makes the answer come back in the right language
 * without being asked twice. A model shown seventy-four Estonian sentences and
 * an Estonian question writes Estonian back; one shown English and asked in
 * Estonian tends to drift into English halfway down.
 */
function catalogueFor(places, lang, open) {
  return places
    .filter((place) => !place.closed)
    .map((place) => {
      const blurb = (place.blurb && (place.blurb[lang] || place.blurb.en)) || '';
      return [
        place.id,
        place.name,
        (place.types || []).join(' '),
        place.price ? place.price + '/4' : '',
        (place.mustOrder || []).join(', '),
        open[place.id] ? 'open until ' + open[place.id] : '',
        blurb.slice(0, BLURB_CHARS)
      ].join(' | ');
    })
    .join('\n');
}

function promptFor(question, places, lang, open) {
  return [
    'Places:',
    'id | name | types | price out of 4 | must order | open now | description',
    catalogueFor(places, lang, open),
    '',
    'Someone asked: ' + question,
    '',
    'Pick at most ' + MAX_PICKS + ' from the list above that best answer them,' +
      ' best first. Use only ids copied exactly from the list. If nothing above' +
      ' fits, return an empty picks array rather than the closest thing.',
    'For each pick write "why" as one short clause about why it answers this' +
      ' particular question — not a description of the place.',
    'Write "say" as one short sentence introducing the picks.',
    'Write "why" and "say" in this language: ' + lang + '.',
    'Answer with JSON only: {"say": "...", "picks": [{"id": "...", "why": "..."}]}'
  ].join('\n');
}

/* The model's answer as an object, however it chose to wrap it.
 *
 * JSON mode is asked for below and is usually honoured, but a small model
 * asked for JSON still sometimes puts it in a ```json fence, or writes a
 * sentence before it. Pulling out the outermost braces and parsing those
 * costs four lines and turns the commonest failure into a non-event; without
 * it the answer is thrown away and the browser falls back for no reason.
 * Anything still unparseable returns null, which is handled like every other
 * failure here.
 */
function unwrap(text) {
  const said = String(text == null ? '' : text);
  const from = said.indexOf('{');
  const to = said.lastIndexOf('}');
  if (from === -1 || to <= from) return null;
  try {
    return JSON.parse(said.slice(from, to + 1));
  } catch (e) {
    return null;
  }
}

/* Whatever came back, reduced to picks that name real places.
 *
 * Every id is checked against the catalogue and every duplicate dropped, so
 * the worst a confused model can do is return fewer places than asked for.
 * The clauses are cut to a length that fits the card rather than trusted:
 * `why` is the one string on this page written by something other than a
 * person, and the browser sets it as text, never as markup. */
function keep(said, places) {
  if (!said || !Array.isArray(said.picks)) return null;

  const real = new Map(places.filter((p) => !p.closed).map((p) => [p.id, p]));
  const picks = [];
  const seen = {};

  for (const pick of said.picks) {
    const id = pick && typeof pick.id === 'string' ? pick.id.trim() : '';
    if (!real.has(id) || seen[id]) continue;
    seen[id] = true;
    picks.push({ id, why: String((pick && pick.why) || '').slice(0, 160) });
    if (picks.length === MAX_PICKS) break;
  }

  if (!picks.length) return null;
  return { picks, say: String(said.say || '').slice(0, 200) };
}

export async function onRequestPost(context) {
  const { request, env } = context;

  if (await wrongDatabase(env)) return json({ ok: false, error: 'wrong-database' }, 503);

  let body = {};
  try {
    body = await request.json();
  } catch (e) {
    return json({ ok: false, error: 'bad-body' }, 400);
  }

  const question = String((body && body.q) || '').slice(0, MAX_QUESTION).trim();
  /* Two letters, because that is every language this site has and the string
     goes into a prompt. Anything else is read as English rather than refused —
     the question is still answerable. */
  const lang = /^[a-z]{2}$/.test(String((body && body.lang) || '')) ? body.lang : 'en';

  if (!question) return json({ ok: false, error: 'no-question' }, 400);

  let places = [];
  try {
    places = await mapPlaces(context);
  } catch (e) {
    return json({ ok: false, error: 'no-catalogue' }, 503);
  }

  const open = await openPlaces(env);

  /* Everything from here on is the model's half, and none of it is allowed to
     take the answer down with it. `source: "none"` is a complete, correct
     answer that the browser knows what to do with — it reads the question
     itself with assets/ask.js and draws the same cards. */
  if (!env.AI) return json({ ok: true, source: 'none', picks: [], say: '', open });

  let said = null;
  try {
    const out = await env.AI.run(MODEL, {
      messages: [
        {
          role: 'system',
          content:
            'You help someone choose where to eat in Tallinn from a fixed list' +
            ' of places. You never invent a place, never use an id that is not' +
            ' in the list, and never describe a place beyond what the list says.'
        },
        { role: 'user', content: promptFor(question, places, lang, open) }
      ],
      /* Asked for, not relied on: unwrap() above handles an answer that
         arrives as prose around the JSON, which is what happens when a model
         or a runtime quietly ignores this. */
      response_format: { type: 'json_schema', json_schema: SCHEMA },
      max_tokens: 400
    });

    said = keep(unwrap(out && (out.response !== undefined ? out.response : out)), places);
  } catch (e) {
    /* The allowance is spent, the model is overloaded, or it has been moved
       behind a paid plan. All three are the same thing here. */
    said = null;
  }

  /* An empty answer and a broken one are the same answer here, and that is
     deliberate rather than lazy. The prompt does ask for an empty picks array
     over a bad guess — but the browser's own reader is literal in a way the
     model is not, and it finds the khachapuri at Gobi off a must-order list
     the model was shown and talked itself out of. A second opinion beats a
     shrug, and if the reader also has nothing the panel says so. */
  if (!said) return json({ ok: true, source: 'none', picks: [], say: '', open });

  return json({ ok: true, source: 'ai', picks: said.picks, say: said.say, open });
}
