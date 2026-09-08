/**
 * Tallinn Tastebuds — the chat box on the map, answered.
 *
 * POST /api/ask   { q, lang, scope, wish, history }
 *                 ->  { ok, source, picks, say, open, venues }
 *
 * Somebody types "somewhere cheap and asian, still open" into the map and this
 * turns it into one to three places off my own list, each with a line saying
 * why. It is the only route here that calls a language model, and the only one
 * that is allowed to answer with nothing and still be working correctly.
 *
 * IT IS A CONVERSATION
 *
 * The question arrives with the exchanges before it — up to six, each what
 * was asked and what was answered, ids and clauses — and they go to the
 * model as the turns they were, so "somewhere cheaper" or "the second one"
 * mean what they would to a person. Nothing is kept here between requests:
 * the browser holds the thread and sends it again each time, and the thread
 * goes when the chat is closed. A Google row named in an earlier answer
 * rides along in the lists whatever the new question scored, so that a
 * follow-up about it can still name it.
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
 * TWO ROLLS, AND WHICH ONE IS ASKED
 *
 * This site has two lists of places and the difference is the point — see the
 * header of /api/venues. The seventy-five in data/restaurants.json are places
 * I have been to and written up; the eleven hundred in `google_venues` are
 * Google's description of the city. The question arrives with a `scope`:
 *
 *   map   my seventy-five and nothing else. The narrower answer, and what a
 *         question that did not say is read as. Being on the map is the
 *         verdict, and an answer off this roll is a recommendation.
 *   all   the city. My places first, and behind them the Google rows I have
 *         not been to — every one of which goes out wearing Google's name,
 *         Google's score and none of my words, drawn on the same "According
 *         to Google" card a list draws for a place off that export. It is
 *         not a recommendation and the card says so.
 *
 * Google's roll is read on the `map` scope for exactly one thing, opening
 * hours, joined on `google_venues.map_id` — the column that says which Google
 * row is which of my places. Sixty of my seventy-five have one. The other
 * fifteen simply have no hours, and an answer about them says nothing about
 * hours rather than guessing.
 *
 * ELEVEN HUNDRED ROWS DO NOT GO INTO A PROMPT
 *
 * The model cannot be shown the whole export: that is thirty thousand tokens
 * a question against a free allowance that would then last an afternoon. So
 * the browser sends what it read the question as — the wish assets/ask.js
 * produces, types and price and open-now and the words left over — and this
 * narrows the export with the same scoring that reader uses, hands the model
 * the forty likeliest, and hands the browser those same forty so that with no
 * model it can rank them itself. The cut is generous on purpose: its one job
 * is "plausibly what was asked for", and the real ranking happens once, in
 * the browser, over my places and these together.
 *
 * The forty go with every answer, on the map scope too. The scope decides
 * how far the model may reach for one — only when nothing of mine fits, or
 * whenever one answers better — rather than whether it is shown them at
 * all, so a question the map cannot answer costs one call and not two.
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

import { json, mapPlaces, venueCard, venueHours, wrongDatabase } from './_lib.js';
/* Claude, when there is a key for it in the Pages environment. Without one
   this returns "no-key" and the Workers AI half below is the whole feature,
   exactly as it was. See the header of _claude.js for why there are two. */
import { askClaude } from './_claude.js';
/* What a Google row cooks, in the directory's ids: the one table that decides
   it, and the string it is asked of. See the note above KITCHENS for why it
   is that table and not VENUE_TYPES — "thai" is a thing to ask for, and the
   map's own vocabulary says only "asian". */
import { KITCHENS, said } from './venues.js';

/* A model that is on the Workers Free plan, and a fast one. Cloudflare has
   moved the larger ones behind Workers Paid before now — @cf/moonshotai/kimi-k2.6
   and @cf/zai-org/glm-5.2 went that way in July 2026 — so the one named here
   is deliberately from the list that stayed free, and changing it is this
   line. A model that has been moved answers 403 and is handled like any
   other failure below: the browser reads the question itself.

   It started life on @cf/google/gemma-4-26b-a4b-it, which was the slow part
   of the whole feature: a reasoning model, thinking through several hundred
   tokens before writing three ids, inside an output budget the thinking
   sometimes used up. This one is a quarter of the size, built for latency,
   and reads all ten of this site's languages; and thinking is switched off
   below either way, because picking three lines out of a list is not a
   thing to deliberate over. @cf/meta/llama-3.1-8b-instruct-fast is the
   other reasonable choice, and weaker in Estonian and Armenian. */
const MODEL = '@cf/zai-org/glm-4.7-flash';

/* Long enough for a real sentence in any of the ten languages, short enough
   that nothing anybody pastes in decides what this costs to run.

   The same number is in assets/ask.js, which is where the browser reads it
   from, and again as the field's maxlength in index.html. It is repeated here
   rather than shared because it is the only one of the three that binds:
   nothing a browser sends can be trusted to have obeyed either of the others. */
const MAX_QUESTION = 200;

/* The most the browser draws, and so the most the model is asked for. Three
   is what a person reads before deciding; the map is already there for the
   other seventy-two. One is a whole answer, and the prompt says so: a model
   told "at most three" pads to three. */
const MAX_PICKS = 3;

/* How many earlier exchanges go back to the model. Six is a conversation
   about an evening; more is a transcript, and each one is read again on
   every question. The browser sends the same six. */
const MAX_HISTORY = 6;

/* Workers AI's code for "you have used up your daily free allocation of
   10,000 Neurons". It arrives as a 429 like the other one that matters —
   3040, out of capacity — and the two mean opposite things: 3040 clears when
   a colo frees up, 3036 clears at midnight UTC and not before. So only this
   one is worth telling somebody about, and it is matched on the code rather
   than on the sentence because the sentence is Cloudflare's to reword. */
const SPENT = '3036';

/* How many Google rows go to the model, and back to the browser.
 *
 * Forty on the whole city, where those rows are the point of the question.
 * Fifteen on the map, where they are a last resort the model may only reach
 * for when nothing of mine fits — carrying forty of them there was paying a
 * thousand tokens a question for a list that is usually not read at all. */
const MAX_CANDIDATES = 40;
const MAX_CANDIDATES_MAP = 15;

/* How many of my own places go to the model.
 *
 * It used to be all seventy, on every question, including the ones that were
 * not about food — about 3,400 tokens of the 4,750 a question cost. That is
 * the whole reason the free Workers AI allowance ran out after something like
 * a hundred and thirty questions: the catalogue was most of the bill and none
 * of it was chosen. Narrowed, with the blurbs cut to a clause, a question is
 * about 1,500 tokens and the same free allowance runs to roughly three
 * hundred.
 *
 * So my places are now narrowed the way the export already was, by the same
 * scoring, and the floor is what makes that safe. A question that names a
 * dish or a type or a price picks its own candidates and they go first; a
 * question that names nothing scores nothing and gets the floor instead. That
 * is not a worse answer, because every place on this map is one I have been
 * to and would send somebody to — there is no bad twenty in it — and the
 * model only ever names three. What the floor buys is the model still having
 * somewhere to choose from when the question is a mood rather than a dish. */
const MAX_CATALOGUE = 30;
const MIN_CATALOGUE = 20;

/* The blurb is the only long field in the catalogue the model sees, and the
   first clause of one is enough to choose on. Sending all of them whole
   would be a hundred and eighty kilobytes of prompt for an answer that names
   three places, and every character here is read seventy-four times a
   question. */
const BLURB_CHARS = 60;

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
let linked = null;
let linkedAt = 0;

async function openPlaces(env, now) {
  if (!env.DB) return {};

  /* The sixty linked rows, kept a minute: the join changes when somebody
     links a row in the database, which is a monthly thing, and a D1 round
     trip a question for it was measurable on the slow path. A minute rather
     than five so a link made by hand shows up while the person is still
     looking. */
  let rows = linked;
  if (!rows || Date.now() - linkedAt > 60000) {
    rows = [];
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
    linked = rows;
    linkedAt = Date.now();
  }

  const open = {};
  for (const row of rows) {
    const shuts = openUntil(venueHours(row.opening_hours), now);
    if (shuts) open[row.map_id] = shuts;
  }
  return open;
}

/* ---------------------------------------------------------------- Google
 * The rest of the city, for a question asked on the `all` scope.
 *
 * Every open, unhidden, still-present row that is not already one of my
 * places — those sixty are on the map roll with a write-up, and offering the
 * Google copy of one beside it would be the same door twice. Kept for five
 * minutes per isolate the way the catalogue is: the table changes when a
 * refresh is loaded and not otherwise, and reading a thousand rows a question
 * for a table that changes monthly is work for nothing. /api/venues reads it
 * fresh because it is a cached GET; this is a POST and has to remember for
 * itself.
 *
 * Each row is carried three ways at once: the card the browser draws (see
 * venueCard() in _lib.js), the week for "open now", and a folded haystack of
 * everything Google says about it, which is what a question's leftover words
 * are matched against.
 */
let venues = null;
let venuesAt = 0;

/* Lowercased and with the accents taken off, and nothing else: "Põhja Konn"
   and "pohja konn" are one string, "Пельменная" keeps every letter. It is not
   fold() in /api/places, which strips to a-z0-9 to ask whether two names are
   one place; this has to leave words as words so a question can land on one. */
function foldWords(value) {
  return String(value == null ? '' : value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ');
}

async function googleVenues(env) {
  if (venues && Date.now() - venuesAt < 300000) return venues;
  if (!env.DB) return [];

  let rows = [];
  try {
    const out = await env.DB
      .prepare(
        'SELECT place_id, name, category, cuisine, tags, price, rating, reviews, ' +
        'address, postal_code, city, phone, website, opening_hours, maps_url, ' +
        'latitude, longitude, map_id FROM google_venues ' +
        "WHERE hidden = 0 AND missing_since IS NULL AND status = 'Open' " +
        'AND map_id IS NULL AND latitude IS NOT NULL'
      )
      .all();
    rows = out.results || [];
  } catch (e) {
    return [];
  }

  venues = rows.map((row) => ({
    card: {
      ...venueCard(row),
      kitchens: KITCHENS.filter((pair) => pair[1].test(said(row))).map((pair) => pair[0])
    },
    week: venueHours(row.opening_hours),
    hay: foldWords([row.name, row.category, row.cuisine, row.tags, row.address].join(' '))
  }));
  venuesAt = Date.now();
  return venues;
}

/* The wish as the browser read it, checked to a shape rather than trusted.
   Nothing here is a secret or a write — it decides which rows are looked at —
   so the checks are about size: a wish with a thousand words in it is not a
   wish, it is somebody seeing what the Function does with one. */
function readWish(raw) {
  const wish = raw && typeof raw === 'object' ? raw : {};
  const words = (list, max) => (Array.isArray(list) ? list : [])
    .filter((w) => typeof w === 'string' && w.length > 0 && w.length <= 40)
    .slice(0, max)
    .map(foldWords);
  return {
    types: words(wish.types, 13),
    kitchens: words(wish.kitchens, 40),
    cheap: !!wish.cheap,
    fancy: !!wish.fancy,
    open: !!wish.open,
    rest: words(wish.rest, 20)
  };
}

/* The thread as the browser sent it, checked to a shape rather than trusted,
   for the same reason and to the same standard as the wish: it goes into a
   prompt, so what matters is that nothing in it is long. Every clause is a
   string the model wrote and the browser sent back, cut here exactly as
   keep() cut it on the way out. */
function readHistory(raw) {
  return (Array.isArray(raw) ? raw : [])
    .filter((turn) => turn && typeof turn.q === 'string' && turn.q.trim())
    .slice(-MAX_HISTORY)
    .map((turn) => ({
      q: turn.q.slice(0, MAX_QUESTION).trim(),
      say: String(turn.say || '').slice(0, 280),
      picks: (Array.isArray(turn.picks) ? turn.picks : [])
        .filter((pick) => pick && typeof pick.id === 'string' && pick.id.length <= 80)
        .slice(0, MAX_PICKS)
        .map((pick) => ({ id: pick.id, why: String(pick.why || '').slice(0, 160) }))
    }));
}

/* The forty Google rows a question is likeliest to be about, best first.
 *
 * The score is rank() in assets/ask.js, number for number — four a type or
 * a cuisine, three each for the price band and open now, one a word — and that is on
 * purpose rather than by accident: the browser ranks my places and these
 * together with that function afterwards, and a row cut here on a different
 * scale would be a row the real ranking never got to see. The two cannot
 * share a file, so change one and look at the other. Ties go to Google's own
 * score and the count behind it, which on Google's rows is the honest
 * tie-break and the only one there is.
 *
 * A row an earlier answer in the thread named comes whatever it scores now,
 * ahead of everything: "is the second one open late" scores nothing in the
 * export, and the second one has to be in the lists for the model to say.
 *
 * What comes back is the card with the haystack on it, so the browser can
 * score it exactly as it scores a place of its own, and — separately, so the
 * browser's one `open` map holds every place on screen — the closing time of
 * each that is open now.
 */
function candidates(roll, wish, now, named, cap) {
  const scored = [];
  const open = {};

  for (const venue of roll) {
    const entry = venue.card;
    const shuts = openUntil(venue.week, now);
    let score = named.has(entry.id) ? 1000 : 0;

    for (const id of wish.types) if (entry.types.includes(id)) score += 4;
    for (const id of wish.kitchens) if (entry.kitchens.includes(id)) score += 4;
    if (wish.cheap && entry.price && entry.price <= 2) score += 3;
    if (wish.fancy && entry.price && entry.price >= 3) score += 3;
    if (wish.open && shuts) score += 3;
    for (const word of wish.rest) if ((' ' + venue.hay).includes(' ' + word)) score += 1;

    if (score > 0) scored.push({ venue, score, shuts });
  }

  scored.sort((a, b) =>
    b.score - a.score ||
    (b.venue.card.rating || 0) - (a.venue.card.rating || 0) ||
    (b.venue.card.reviews || 0) - (a.venue.card.reviews || 0));

  const out = scored.slice(0, cap).map(({ venue, shuts }) => {
    if (shuts) open[venue.card.id] = shuts;
    return { ...venue.card, hay: venue.hay };
  });

  return { venues: out, open };
}

/* My own places, narrowed to the ones this question could be about.
 *
 * The same scoring as candidates() above and as rank() in assets/ask.js —
 * four a type, three a price band, three for open now, one a word — because
 * a place cut here is a place the answer can never name, and cutting on a
 * different scale from the one that does the real ranking would drop exactly
 * the places the ranking was about to choose.
 *
 * Two things go in whatever they score. A place an earlier answer in this
 * thread named, so "is the second one open late" still has the second one to
 * be about; and, once the scorers are in, enough of the rest to reach the
 * floor, in catalogue order, so a question that names nothing still has a map
 * to choose from.
 */
function shortlist(places, wish, open, lang, named) {
  const live = places.filter((place) => !place.closed);
  if (live.length <= MIN_CATALOGUE) return live;

  const scored = [];
  const rest = [];

  for (const place of live) {
    const types = place.types || [];
    let score = named.has(place.id) ? 1000 : 0;

    for (const id of wish.types) if (types.includes(id)) score += 4;
    if (wish.cheap && place.price && place.price <= 2) score += 3;
    if (wish.fancy && place.price && place.price >= 3) score += 3;
    if (wish.open && open[place.id]) score += 3;

    if (wish.rest.length) {
      /* Name, dishes, types and the write-up — the same haystack the browser
         builds for its own reader, so a dish nobody wrote into the taxonomy
         still finds its place. */
      const hay = ' ' + foldWords([
        place.name,
        (place.mustOrder || []).join(' '),
        types.join(' '),
        (place.blurb && (place.blurb[lang] || place.blurb.en)) || ''
      ].join(' '));
      for (const word of wish.rest) if (hay.includes(' ' + word)) score += 1;
    }

    if (score > 0) scored.push({ place, score });
    else rest.push(place);
  }

  /* Stable, so places that scored the same keep the order the catalogue put
     them in and the same question twice is the same answer. */
  scored.sort((a, b) => b.score - a.score);

  const out = scored.slice(0, MAX_CATALOGUE).map((hit) => hit.place);
  for (const place of rest) {
    if (out.length >= MIN_CATALOGUE) break;
    out.push(place);
  }

  return out;
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
function catalogueFor(places, lang) {
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
        blurb.slice(0, BLURB_CHARS)
      ].join(' | ');
    })
    .join('\n');
}

/* Which of my places are open, as a line rather than as a column in the
   catalogue above.

   It reads worse there and it is worth it: the hours change through the
   evening and the catalogue does not, and on the Claude path the catalogue
   is a cached prefix that anything changing inside it would invalidate. One
   builder feeds both models, so the split lives here rather than twice. */
function openLine(open) {
  const ids = Object.keys(open || {});
  if (!ids.length) return '';
  return 'Open in Tallinn right now, and until when: ' +
    ids.map((id) => id + ' until ' + open[id]).join(', ');
}

/* Google's rows as the model reads them: what Google files the place as and
   what Google's reviewers make of it, which is all anybody knows. No
   description, because there is none — and the model is told as much, so it
   does not write one. */
function googleFor(rows) {
  return rows
    .map((row) => [
      row.id,
      row.name,
      (row.types || []).concat(row.kitchens || []).join(' '),
      row.price ? row.price + '/4' : '',
      row.rating ? row.rating + ' from ' + (row.reviews || 0) + ' reviews' : ''
    ].join(' | '))
    .join('\n');
}

/* What the model is told once, before the conversation: who it is, the
   lists, and the rules. The lists go here rather than with the question so
   that the thread under them reads as turns of a conversation about them,
   which is what lets a follow-up mean what it says. */
function briefFor(places, google, wholeCity, lang, open) {
  const lines = [
    'You are the voice of Tallinn Tastebuds, a map of places to eat in' +
      ' Tallinn, chatting with a visitor. You help them choose where to eat' +
      ' from the fixed lists below. You never invent a place, never use an id' +
      ' that is not in the lists, and never describe a place beyond what the' +
      ' lists say.',
    '',
    'Places I have eaten at and written up:',
    'id | name | types | price out of 4 | must order | description',
    catalogueFor(places, lang)
  ];

  const hours = openLine(open);
  if (hours) lines.push('', hours);

  /* The city's forty go in on both scopes, and the scope is the sentence
     over them. On the map they are a last resort — the model may reach for
     one only when nothing of mine fits, which is the fallback the browser
     used to make as a second whole request; on the city they are fair game
     wherever one answers better. One call either way. */
  if (google.length) {
    lines.push(
      '',
      wholeCity
        ? 'Places from Google that I have not been to. Prefer a place above' +
          ' when it answers the question as well; use these when one of them' +
          ' answers it better:'
        : 'Places from Google that I have not been to. Use these ONLY if' +
          ' nothing in the first list answers the question at all:',
      'id | name | types and cuisine | price out of 4 | Google rating | open now',
      googleFor(google)
    );
  }

  lines.push(
    '',
    'Each message is a question or a reply from the same person, in a' +
      ' conversation; a follow-up refers to what you said before, so read it' +
      ' that way.',
    'Answer each with one to ' + MAX_PICKS + ' places from the lists, best' +
      ' first — only as many as genuinely answer it, and one is a complete' +
      ' answer. Use only ids copied exactly from the lists. If nothing fits,' +
      ' return an empty picks array and say so, or ask what they meant, in' +
      ' "say". If the message is not about where to eat at all — a greeting,' +
      ' thanks, or a question about what this is or how it works — reply to' +
      ' it the way a person would, in one short friendly sentence in "say",' +
      ' with no picks. Asked how it works, say something like: by asking' +
      ' what you feel like eating — a dish, a mood or a budget — and picking' +
      ' a place for it.',
    'For each pick write "why": at most twelve words on why it answers this' +
      ' particular question, not a description of the place. For a place from' +
      ' Google say only what its line says.',
    'Write "say" as one or two short sentences, the way a person replies in' +
      ' a chat, introducing the picks or answering what was asked.',
    'Write "why" and "say" in this language: ' + lang + '.',
    'Answer with JSON only, nothing before or after it:' +
      ' {"say": "...", "picks": [{"id": "...", "why": "..."}]}'
  );

  return lines.join('\n');
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

/* Whatever came back, reduced to picks that name real places, and what was
 * said over them.
 *
 * Every id is checked against what the model was actually shown — my places
 * and the forty Google rows — and every duplicate dropped, so the worst a
 * confused model can do is return fewer places than asked for. The clauses
 * are cut to a length that fits the card rather than trusted: `why` and
 * `say` are the strings on this page written by something other than a
 * person, and the browser sets them as text, never as markup.
 *
 * No picks and a sentence is an answer, not a failure: the model asked
 * back, or said in its own words that nothing fits, and in a conversation
 * that is a turn. No picks and nothing said is the failure. */
function keep(said, shown) {
  if (!said || !Array.isArray(said.picks)) return null;

  const picks = [];
  const seen = {};

  for (const pick of said.picks) {
    const id = pick && typeof pick.id === 'string' ? pick.id.trim() : '';
    if (!shown.has(id) || seen[id]) continue;
    seen[id] = true;
    picks.push({ id, why: String((pick && pick.why) || '').slice(0, 160) });
    if (picks.length === MAX_PICKS) break;
  }

  const say = String(said.say || '').slice(0, 280);
  if (!picks.length && !say) return null;
  return { picks, say };
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
  /* Anything that is not the whole city is the map: the narrower answer is
     the safe one to give a request that did not say. */
  const wholeCity = body && body.scope === 'all';

  if (!question) return json({ ok: false, error: 'no-question' }, 400);

  let places = [];
  try {
    places = await mapPlaces(context);
  } catch (e) {
    return json({ ok: false, error: 'no-catalogue' }, 503);
  }

  const now = tallinnNow();
  const open = await openPlaces(env, now);

  /* The city, narrowed to what the question could be about — on both scopes.
     It used to be asked for only on the city, and a question the map had no
     answer to cost a second whole request, model and all, to find out. Now
     the forty travel with every answer: the model sees them under a sentence
     that says how far it may reach for one, and the browser, with no model,
     ranks my places first and these only when mine come to nothing. An empty
     list is a complete answer too: nothing in the export scored. */
  const history = readHistory(body.history);
  const named = new Set(history.flatMap((turn) => turn.picks.map((pick) => pick.id)));
  const wish = readWish(body.wish);
  const cut = candidates(
    await googleVenues(env), wish, now, named,
    wholeCity ? MAX_CANDIDATES : MAX_CANDIDATES_MAP
  );
  const google = cut.venues;
  Object.assign(open, cut.open);

  /* Not the whole map any more — the slice of it this question could be
     about. See shortlist(): the catalogue was most of what a question cost
     and none of it was chosen. Both models are shown the same slice, so
     which one answers cannot change which places were available to name. */
  const mine = shortlist(places, wish, open, lang, named);

  /* `note` is not for the page — nothing draws it — it is so that a chat
     answering with the browser's keyword reader can be told apart from a
     chat answering with a model, from outside, in one request. This feature
     was silently down for a day because every failure looked identical: no
     key, spent allowance, overloaded model and dead network all arrived as
     the same empty answer. It names which, never why in the provider's own
     words, so nothing quotes a request back at a stranger. */
  const answer = (source, picks, say, note) =>
    json({ ok: true, source, picks, say, note, open, venues: google });

  /* Exactly what was sent, so an id the model did not see is dropped rather
     than drawn. It is the guard that makes a hallucinated place unreachable
     — see the header — and it is built from the slice for that reason. */
  const shown = new Set([...mine.map((p) => p.id), ...google.map((g) => g.id)]);

  /* Claude first, when the key is there. It is the half that can hold a
     conversation — a follow-up read against what was just said, and a
     greeting answered as a greeting — which is the whole reason it was
     added; see the header of _claude.js. */
  const claude = await askClaude(env, {
    question,
    history,
    catalogue: catalogueFor(mine, lang),
    google: googleFor(google),
    wholeCity,
    lang,
    open,
    maxPicks: MAX_PICKS
  });

  if (claude.ok) {
    const kept = keep(claude.said, shown);
    if (kept) return answer('ai', kept.picks, kept.say, 'claude');
  }

  /* Everything from here on is Workers AI's half, and none of it is allowed
     to take the answer down with it. `source: "none"` is a complete, correct
     answer that the browser knows what to do with — it reads the question
     itself with assets/ask.js and draws the same cards. */
  if (!env.AI) return answer('none', [], '', claude.note);

  /* The conversation as the model sees it: the brief, then every earlier
     exchange as the two turns it was — the question, and the answer in the
     exact JSON shape asked for, which is also the shape it will write next
     — and the new question last. */
  const messages = [{ role: 'system', content: briefFor(mine, google, wholeCity, lang, open) }];
  for (const turn of history) {
    messages.push({ role: 'user', content: turn.q });
    messages.push({ role: 'assistant', content: JSON.stringify({ say: turn.say, picks: turn.picks }) });
  }
  messages.push({ role: 'user', content: question });

  let said = null;
  let spent = false;
  try {
    const out = await env.AI.run(MODEL, {
      messages,
      /* Asked for, not relied on: unwrap() above handles an answer that
         arrives as prose around the JSON, which is what happens when a model
         or a runtime quietly ignores this. */
      response_format: { type: 'json_schema', json_schema: SCHEMA },
      /* No thinking. This is the line the first model was missing, and it
         was most of the wait: a reasoning model left to reason deliberates
         through hundreds of tokens before the first character of an answer
         that is three ids long. Cloudflare's own example passes this. */
      chat_template_kwargs: { enable_thinking: false },
      /* Three picks of a dozen words, a sentence or two, and the JSON around
         them. The budget is the ceiling on how long a question can take. */
      max_tokens: 300
    });

    /* Two shapes come back from env.AI.run(), and this model uses the second.
       The older models on Workers AI answer as { response: "..." }; the ones
       with an OpenAI-style parameter list — max_completion_tokens,
       service_tier, this one — answer as a chat completion, with the words
       at choices[0].message.content and any thinking beside them in a field
       of their own. Reading only `response` here meant `undefined`, then the
       whole object handed to unwrap(), which stringified it to
       "[object Object]", found no brace and returned null: every answer this
       model ever gave was thrown away, quietly, and the browser's keyword
       reader answered in its place for the whole of its first year. Nobody
       could tell, because the reader is right about most questions people
       type. Both shapes are read now, so a future model swap cannot do this
       again. */
    const text = out && typeof out.response === 'string'
      ? out.response
      : out && out.choices && out.choices[0] && out.choices[0].message
        ? out.choices[0].message.content
        : null;
    said = keep(unwrap(text), shown);
  } catch (e) {
    /* The daily Neurons are spent, the model is overloaded, or it has been
       moved behind a paid plan. Two of those are worth nothing to a reader
       and are handled below as they always were; the first is worth saying
       out loud, because it is the one that will still be true in an hour and
       the only one somebody can do something about — come back tomorrow. */
    spent = String((e && e.message) || '').includes(SPENT);
    said = null;
  }

  /* A broken answer is no answer, and the browser reads the question
     itself. An answer with a sentence and no places goes back as it is,
     source "ai", and the browser shows it as the reply: in a chat the
     model saying "that is not a question about where to eat" has to beat
     the browser's own reader finding three places for "how does it work"
     off the letters in their names. */
  /* Out of Neurons until midnight UTC. The browser draws this as the chat
     saying it is resting rather than as an answer, and does not fall through
     to its own keyword reader: three places matched on letters under a
     sentence about an evening is exactly the impersonation this whole
     feature has been trying to stop doing. */
  if (spent) return answer('resting', [], '', claude.note + '/workers-ai-spent');

  if (!said) return answer('none', [], '', claude.note + '/workers-ai-none');

  return answer('ai', said.picks, said.say, 'workers-ai');
}
