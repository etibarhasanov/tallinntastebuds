/**
 * Tallinn Tastebuds — the chat box on the map, answered.
 *
 * POST /api/ask   { q, lang, scope, wish, history }
 *                 ->  { ok, source, picks, say, open, venues, at }
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
 *   map   my places and nothing else. The model is shown no Google row, so
 *         it cannot name one; a question the map cannot answer is answered
 *         with a shrug and a nudge towards the other button. It used to be
 *         answered off the city, with the pressed button moved to All
 *         Tallinn behind the reader's back, and that read as the switch
 *         working the wrong way round. Being on the map is the verdict, and
 *         an answer off this roll is a recommendation.
 *   all   the city, and both of it: every answer names at least one place
 *         of mine and at least one from the rest of Tallinn. That is the
 *         rule the model is given, in those words, because without it every
 *         answer leant on my map whatever the button said — my lines carry
 *         a dish and a write-up and Google's carry a rating, and a model
 *         asked for a reason reaches for the line it can give one from.
 *         Every Google row goes out wearing Google's name, Google's score
 *         and none of my words, drawn on the same "According to Google"
 *         card a list draws for a place off that export. It is not a
 *         recommendation and the card says so.
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
 * produces: types and price and open-now, what to be near, and the words
 * left over — and this narrows the export with the same scoring, hands the
 * model the forty likeliest, and hands the browser those same forty so it
 * can draw and pin whichever the model names. The cut is generous on purpose: its one job is
 * "plausibly what was asked for", and the choosing happens once, in the
 * model, over my places and these together.
 *
 * The forty go only on the city. On the map the model is shown none, which
 * is what makes the map scope mean what it says.
 *
 * WHERE THE VISITOR IS
 *
 * "Something close to my place, Laulupeo street" was once answered with "I
 * don't have a place on Telliskivi 35 in my map" over Ariran, "2 minutes
 * from your place" — Telliskivi 35 being Ariran's own line. Every place here
 * has a point and the model was shown none of them, and the street the
 * visitor typed was text: it had nothing to measure with, so it borrowed a
 * street off the catalogue for theirs and invented a walk between the two.
 *
 * So a question that says near — close to, lähedal, рядом; the words are in
 * data/ui.json beside cheap and open — is read by the browser for what it
 * wants to be near, and that goes to Photon through the lookup /api/geocode
 * already has for the add-a-place form, and comes back as a point in Tallinn
 * or as nothing. With a point, every line the model reads ends with its
 * straight-line distance from there, the nearest score as a named type
 * would, and the prompt says where the visitor is. Without one — a spelling
 * Photon cannot place, a street outside the box, Photon busy — the prompt
 * says the visitor's whereabouts are unknown, that a street in the question
 * is theirs and never a place's, and that no distance may be stated; the
 * honest answer to that question is then to say so and ask which part of
 * town. One lookup a question, only when asked for, cached upstream a day.
 *
 * What was measured from goes back to the browser as `at`, and the chat
 * prints it under the reply — "Distances are from Tallinna bussijaam,
 * Kesklinn". That line is the visitor's check on the whole chain: a street
 * Photon placed in the wrong town, or a name it read as some other name,
 * shows up there as the wrong words, where without it the only symptom is
 * three good places that are somehow not the ones round the corner.
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
 * the hours still in it and a 200, and the chat says it has nothing. It
 * used to fall back to a keyword reader in the browser at that point, and
 * that reader drew rows for questions it had no clue about with nothing
 * under them saying why; the chat brings nothing rather than that now.
 */

import { json, mapPlaces, venueCard, venueHours, wrongDatabase } from './_lib.js';
/* What a Google row cooks, in the directory's ids, off the one table that
   decides it — and in the order the directory says them, so a card here reads
   the same as a card there. See the note above KITCHENS for why it is that
   table and not VENUE_TYPES — "thai" is a thing to ask for, and the map's own
   vocabulary says only "asian". */
import { kitchensOf } from './venues.js';
/* The one lookup behind /api/geocode's suggestions, asked here for where a
   visitor said they are. See WHERE THE VISITOR IS above. */
import { suggest } from './geocode.js';

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

/* How many Google rows go to the model, and back to the browser, on the
   whole city. On the map, none: see the two scopes in the header. */
const MAX_CANDIDATES = 40;

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
      kitchens: kitchensOf(row)
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
    /* What they want to be near, as words — a street, a district, a name.
       Folded like the rest, and short: eighty characters is a long address,
       and this one goes upstream. */
    near: typeof wish.near === 'string' ? foldWords(wish.near).trim().slice(0, 80) : '',
    rest: words(wish.rest, 20)
  };
}

/* ------------------------------------------------------------ the visitor
 * Where the visitor said they are, as a point — or null, which is "unknown"
 * and is what most questions are.
 *
 * Asked only when the browser read a near phrase and something after it, so
 * "cheap ramen" never reaches Photon, and once a question when it does. The
 * first suggestion is the answer: for a street it is the street, for a
 * district the district, and for a name Photon knows it is the door. Every
 * way this can fail — no fetch, Photon busy or down, too short to ask,
 * nothing inside the box — is null, and null is answered honestly by the
 * brief rather than worked around: a wrong point would put "1.2 km" on
 * every line in the site's own voice.
 */
async function visitorAt(wish) {
  if (!wish.near) return null;
  try {
    const found = await suggest(wish.near);
    const hit = found.results && found.results[0];
    return hit ? { lat: hit.lat, lng: hit.lng, label: hit.label, where: hit.where } : null;
  } catch (e) {
    return null;
  }
}

/* Kilometres between two points as the crow flies, which the model is told
   they are: a rail yard or the bay can double the walk. */
function km(a, b) {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const s = Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(s));
}

/* How far a row is from the visitor, or nothing: nobody said where they
   are, or the row has no point. The distance is kept once per row and read
   twice, for the score and for the line. */
function farFrom(at, entry) {
  if (!at || typeof entry.lat !== 'number' || typeof entry.lng !== 'number') return null;
  return km(at, entry);
}

/* A distance as the model reads it — "650 m", "1.2 km" — or nothing. */
function distanceLine(far) {
  if (far == null) return '';
  return far < 1 ? Math.round(far * 20) * 50 + ' m' : far.toFixed(1) + ' km';
}

/* Nearness on the scale everything else here scores on: four for within a
   kilometre, the same as naming a type, and one less for each kilometre
   after, so "close to Laulupeo" puts the walkable ones ahead and leaves the
   far side of town to score on whatever else was said. */
function nearScore(far) {
  return far == null ? 0 : Math.max(0, 4 - Math.floor(far));
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
 * The score is shortlist()'s below, number for number — four a type or a
 * cuisine, four for next door, three each for the price band and open now,
 * one a word — and that is on purpose rather than by accident: the model
 * chooses over my places and these together, and a roll cut on a different
 * scale from the other would be the roll whose best rows the model never
 * saw. Change one and look at the other. Ties go to the nearer row when
 * somebody said where they are, then to Google's own score and the count
 * behind it, which on Google's rows is the honest tie-break and the only
 * one there is.
 *
 * A row an earlier answer in the thread named comes whatever it scores now,
 * ahead of everything: "is the second one open late" scores nothing in the
 * export, and the second one has to be in the lists for the model to say.
 *
 * Rows that score nothing come too, best-rated first, up to the cap. Without
 * that a vague question — "somewhere nice", "not sure" — scored no Google
 * row and sent none, so a visitor who pressed All Tallinn and asked for a
 * mood could only ever be answered off my map: the model had no city to
 * choose from. My own places have had that floor since they were narrowed;
 * this is the same floor for the other roll. Only ever called on the city.
 *
 * What comes back is the card, so the browser can draw whichever of these
 * the model names as the stand-in a list draws for a Google place, and —
 * separately, so the browser's one `open` map holds every place on screen —
 * the closing time of each that is open now.
 */
function candidates(roll, wish, now, named, at) {
  const scored = [];
  const open = {};

  for (const venue of roll) {
    const entry = venue.card;
    const shuts = openUntil(venue.week, now);
    const far = farFrom(at, entry);
    let score = named.has(entry.id) ? 1000 : 0;

    for (const id of wish.types) if (entry.types.includes(id)) score += 4;
    for (const id of wish.kitchens) if (entry.kitchens.includes(id)) score += 4;
    score += nearScore(far);
    if (wish.cheap && entry.price && entry.price <= 2) score += 3;
    if (wish.fancy && entry.price && entry.price >= 3) score += 3;
    if (wish.open && shuts) score += 3;
    for (const word of wish.rest) if ((' ' + venue.hay).includes(' ' + word)) score += 1;

    scored.push({ venue, score, shuts, far });
  }

  scored.sort((a, b) =>
    b.score - a.score ||
    (a.far || 0) - (b.far || 0) ||
    (b.venue.card.rating || 0) - (a.venue.card.rating || 0) ||
    (b.venue.card.reviews || 0) - (a.venue.card.reviews || 0));

  const out = scored.slice(0, MAX_CANDIDATES).map(({ venue, shuts, far }) => {
    if (shuts) open[venue.card.id] = shuts;
    return { ...venue.card, far };
  });

  return { venues: out, open };
}

/* My own places, narrowed to the ones this question could be about.
 *
 * The same scoring as candidates() above — four a type, four for next door,
 * three a price band, three for open now, one a word — because a place cut
 * here is a place the answer can never name, and the model chooses over
 * both rolls at once: cut one on a different scale and its best rows are
 * the ones the model never saw.
 *
 * Two things go in whatever they score. A place an earlier answer in this
 * thread named, so "is the second one open late" still has the second one to
 * be about; and, once the scorers are in, enough of the rest to reach the
 * floor, in catalogue order, so a question that names nothing still has a map
 * to choose from.
 */
function shortlist(places, wish, open, lang, named, at) {
  const live = places.filter((place) => !place.closed);
  if (live.length <= MIN_CATALOGUE) return live;

  const scored = [];
  const rest = [];

  for (const place of live) {
    const types = place.types || [];
    const far = farFrom(at, place);
    let score = named.has(place.id) ? 1000 : 0;

    for (const id of wish.types) if (types.includes(id)) score += 4;
    score += nearScore(far);
    if (wish.cheap && place.price && place.price <= 2) score += 3;
    if (wish.fancy && place.price && place.price >= 3) score += 3;
    if (wish.open && open[place.id]) score += 3;

    if (wish.rest.length) {
      /* Name, street, dishes, types and the write-up, so a dish nobody
         wrote into the taxonomy still finds its place and so does a street:
         "kopli" reaches Bekker, "viimsi" reaches Buxhöwden. The address was
         missing from this for a while, and a question naming a place in the
         city narrowed on nothing. */
      const hay = ' ' + foldWords([
        place.name,
        place.address,
        (place.mustOrder || []).join(' '),
        types.join(' '),
        (place.blurb && (place.blurb[lang] || place.blurb.en)) || ''
      ].join(' '));
      for (const word of wish.rest) if (hay.includes(' ' + word)) score += 1;
    }

    if (score > 0) scored.push({ place: { ...place, far }, score, far });
    else rest.push(place);
  }

  /* Nearer first among equals when somebody said where they are; otherwise
     stable, so places that scored the same keep the order the catalogue put
     them in and the same question twice is the same answer. */
  scored.sort((a, b) => b.score - a.score || (a.far || 0) - (b.far || 0));

  const out = scored.slice(0, MAX_CATALOGUE).map((hit) => hit.place);

  /* The floor is a cross-section, not the top of the alphabet. It used to be
     the first of the rest in catalogue order, which is alphabetical, so every
     question that scored nothing put the same A-to-F slice in front of the
     model — and "kesklinn" was answered with three bakeries that happened to
     begin with B. Taking one place per type in turn, and round again, gives
     a mood question one bakery, one bar, one restaurant and so on to choose
     from. Still deterministic, so the same question twice is the same
     answer. */
  const byType = {};
  for (const place of rest) {
    const type = (place.types || [])[0] || '';
    (byType[type] = byType[type] || []).push(place);
  }
  const lanes = Object.keys(byType).sort().map((type) => byType[type]);
  for (let i = 0; out.length < MIN_CATALOGUE; i++) {
    let took = false;
    for (const lane of lanes) {
      if (i < lane.length && out.length < MIN_CATALOGUE) { out.push(lane[i]); took = true; }
    }
    if (!took) break;
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
/* An address as the model should read it: the street and the district, and
   not ", 10140 Tallinn" on the end of every line, which is thirty tokens a
   question that say nothing — everything here is in Tallinn. What is kept
   is what places a place: "Suur-Karja 12" is the Old Town, "Ranna tee 5/2,
   Miiduranna, Viimsi" is out past Pirita, and a model that can read either
   has no business calling the second one central. When the visitor said
   where they are, the distance from there follows — "Telliskivi 35 · 3.1
   km" — which is the one number on the line the model may repeat. */
function whereIs(entry) {
  const street = String(entry.address || '').replace(/,\s*\d{5}\s+Tallinn\s*$/i, '').trim();
  return [street, distanceLine(entry.far)].filter(Boolean).join(' · ');
}

function catalogueFor(places, lang) {
  return places
    .filter((place) => !place.closed)
    .map((place) => {
      const blurb = (place.blurb && (place.blurb[lang] || place.blurb.en)) || '';
      return [
        place.id,
        place.name,
        whereIs(place),
        (place.types || []).join(' '),
        place.price ? place.price + '/4' : '',
        (place.mustOrder || []).join(', '),
        blurb.slice(0, BLURB_CHARS)
      ].join(' | ');
    })
    .join('\n');
}

/* Which of my places are open, as one line rather than as a column in the
   catalogue above. The hours change through the evening and the catalogue
   does not, and most of that column was empty cells: one line naming the
   handful that are open is fewer tokens and easier to read. */
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
      whereIs(row),
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
function briefFor(places, google, wholeCity, lang, open, at) {
  const lines = [
    'You are the voice of Tallinn Tastebuds, a map of places to eat in' +
      ' Tallinn, chatting with a visitor. You help them choose where to eat' +
      ' from the fixed lists below. You never invent a place, never use an id' +
      ' that is not in the lists, and never describe a place beyond what the' +
      ' lists say.',
    '',
    'MY MAP — places I have eaten at and written up:',
    'id | name | where | types | price out of 4 | must order | description',
    catalogueFor(places, lang)
  ];

  const hours = openLine(open);
  if (hours) lines.push('', hours);

  /* The city's forty, on the city only — on the map `google` is empty and
     none of this is said. The rule under them is the one the owner set,
     in so many words: at least one of each list, every answer. A model
     asked for a reason on every pick reaches for the lines it can give one
     from, and mine carry a dish and a write-up where Google's carry a
     rating, so without the rule every answer leant on my map. */
  if (google.length) {
    lines.push(
      '',
      'REST OF TALLINN — places from Google that I have NOT been to:',
      'id | name | where | types and cuisine | price out of 4 | Google rating',
      googleFor(google),
      '',
      'The visitor asked for all of Tallinn. EVERY answer with places MUST' +
        ' name at least one from MY MAP and at least one from REST OF' +
        ' TALLINN — never all from one list. Choose the best of each for the' +
        ' question. About a REST OF TALLINN place say only what its line' +
        ' says. If nothing on either list fits, say so with an empty picks' +
        ' array.'
    );
  } else {
    lines.push(
      '',
      'The visitor asked for MY MAP only. If nothing on it fits, say so' +
        ' plainly with an empty picks array and suggest they try All Tallinn.'
    );
  }

  lines.push(
    '',
    'Each message is a question or a reply from the same person, in a' +
      ' conversation; a follow-up refers to what you said before, so read it' +
      ' that way.',
    /* Said because it is true and because a small model shown a distance
       column otherwise sorts by it and nothing else: "coffee next to the
       bus station" came back as the three nearest doors to the station, a
       Caucasian restaurant, a ramen bar and a pub, with a coffee shop at
       400 m left on the list. The lists are already in the order the
       narrowing scored them — the kind asked for and near it first — so the
       model is told that the order means something, and that the kind of
       place asked for is not negotiable against a smaller number. */
    'The lines in each list are in order of how well they fit what was' +
      ' asked, best first. When the visitor asked for a kind of place — a' +
      ' café, a bakery, ramen — every pick is of that kind; a nearer, cheaper' +
      ' or better-rated place of another kind is not an answer to that' +
      ' question, and if no place of that kind fits, say so.',
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
    'EVERY pick carries a "why", never empty: at most twelve words on why' +
      ' THAT place answers THIS question — the dish they asked for, what suits' +
      ' the occasion, what makes it the cheap one. Never a description of the' +
      ' place and never its type or price read back, which the card under it' +
      ' already prints. For a place from Google say only what its line says.',
    'A "why" must be TRUE TO THE LINE. Say a place is central, near the' +
      ' harbour, open late, cheap, quiet, anything — only if its line says so' +
      ' or its "where" shows it. Never repeat the question\'s words back as a' +
      ' reason the line does not support: a place whose line says it is out' +
      ' towards Viimsi is not "in the city centre" because the centre was' +
      ' asked for. If the line gives you no true reason for THIS question,' +
      ' leave the place out; a shorter honest answer beats an invented' +
      ' reason, and the "say" must not claim what the picks do not support.',
    /* The visitor's whereabouts — see WHERE THE VISITOR IS in the header.
       Known, the distances on the lines are the only distances there are
       and the model is told to read them and nothing else. Unknown, the
       model is told so in as many words, because left to itself it once
       took a place's street for the visitor's and invented a walk: a
       street in the question is theirs, no distance may be stated, and the
       honest answer says it cannot judge and asks which part of town. */
    at
      ? 'WHERE THE VISITOR IS: at ' + [at.label, at.where].filter(Boolean).join(', ') +
        ', the place they said they are near. The "where" of every line ends' +
        ' with the straight-line distance from there, and "close" means the' +
        ' smallest. Quote a distance only as its line gives it — never as' +
        ' minutes, and never for a line that has none.'
      : 'WHERE THE VISITOR IS: unknown. You know nothing about where they' +
        ' are, live or are staying beyond what they type, and nothing about' +
        ' how far anything is from it. A street, address or district in their' +
        ' message is THEIR location, never a place on the lists: do not read' +
        ' it back as a place\'s address, and never swap it for one. Never' +
        ' state or imply a distance or a walking time. A place is near them' +
        ' only if its "where" names the same street or district they wrote;' +
        ' then say where it is, not how far. If no "where" does, say plainly' +
        ' that you cannot judge distance from the street they named, spelled' +
        ' the way they spelled it, and ask which district or part of town it' +
        ' is in.',
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
    const why = String((pick && pick.why) || '').trim().slice(0, 160);
    /* A place with no reason is not a pick. The prompt asks for one on
       every place and a small model still sometimes leaves it blank; a row
       drawn with nothing under it is the answer refusing to say why it is an
       answer, and the owner would rather have the sentence alone. So the id
       is dropped here, and if every id goes the sentence still stands. */
    if (!why || !shown.has(id) || seen[id]) continue;
    seen[id] = true;
    picks.push({ id, why });
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
  const history = readHistory(body.history);
  const named = new Set(history.flatMap((turn) => turn.picks.map((pick) => pick.id)));
  const wish = readWish(body.wish);

  /* The hours and the visitor's point are two waits on two other services,
     and neither needs the other, so they run together. */
  const [open, at] = await Promise.all([openPlaces(env, now), visitorAt(wish)]);

  /* The city's rows, on the city only. On the map the model is shown none,
     so it cannot name one, and the button means what it says. An empty list
     is a complete answer too: nothing in the export scored. */
  const cut = wholeCity
    ? candidates(await googleVenues(env), wish, now, named, at)
    : { venues: [], open: {} };
  const google = cut.venues;
  Object.assign(open, cut.open);

  /* Not the whole map any more — the slice of it this question could be
     about. See shortlist(): the catalogue was most of what a question cost
     and none of it was chosen. */
  const mine = shortlist(places, wish, open, lang, named, at);

  /* `note` is not for the page — nothing draws it — it is so that a chat
     answering with the browser's keyword reader can be told apart from a
     chat answering with the model, from outside, in one request. This
     feature answered with the reader for its whole first year and nobody
     could tell, because every way out looked identical: no binding, spent
     allowance, overloaded model and a reply read at the wrong key all
     arrived as the same empty answer. It names which, never why in
     Cloudflare's own words, so nothing quotes a request back at a
     stranger. */
  /* The distance rides on each Google row only as far as the prompt; the
     browser draws nothing with it, so it does not travel. What was measured
     from does, without its point: the chat prints the words under the
     reply so the visitor can see what "near" was taken to mean. */
  const answer = (source, picks, say, note) =>
    json({
      ok: true, source, picks, say, note, open,
      venues: google.map(({ far, ...card }) => card),
      /* Without the city on the end: everything here is in Tallinn, and
         whereIs() drops it from every line for the same reason. */
      at: at ? { label: at.label, where: at.where.replace(/,\s*Tallinn$/, '') } : null
    });

  /* Exactly what was sent, so an id the model did not see is dropped rather
     than drawn. It is the guard that makes a hallucinated place unreachable
     — see the header — and it is built from the slice for that reason. */
  const shown = new Set([...mine.map((p) => p.id), ...google.map((g) => g.id)]);

  /* Everything from here on is the model's half, and none of it is allowed
     to take the answer down with it. `source: "none"` is a complete, correct
     answer that the browser knows what to do with — it reads the question
     itself with assets/ask.js and draws the same cards. */
  if (!env.AI) return answer('none', [], '', 'no-ai');

  /* The conversation as the model sees it: the brief, then every earlier
     exchange as the two turns it was — the question, and the answer in the
     exact JSON shape asked for, which is also the shape it will write next
     — and the new question last. */
  const messages = [{ role: 'system', content: briefFor(mine, google, wholeCity, lang, open, at) }];
  for (const turn of history) {
    messages.push({ role: 'user', content: turn.q });
    messages.push({ role: 'assistant', content: JSON.stringify({ say: turn.say, picks: turn.picks }) });
  }
  messages.push({ role: 'user', content: question });

  /* One call to the model: turns in, what keep() makes of the reply out, and
     whether the call died because the day's Neurons are spent. A function
     rather than a block because the city can need it twice — see the rule
     under it. */
  const askModel = async (turns) => {
    let out;
    try {
      out = await env.AI.run(MODEL, {
        messages: turns,
        /* Asked for, not relied on: unwrap() above handles an answer that
           arrives as prose around the JSON, which is what happens when a
           model or a runtime quietly ignores this. */
        response_format: { type: 'json_schema', json_schema: SCHEMA },
        /* No thinking. This is the line the first model was missing, and it
           was most of the wait: a reasoning model left to reason deliberates
           through hundreds of tokens before the first character of an
           answer that is three ids long. Cloudflare's own example passes
           this. */
        chat_template_kwargs: { enable_thinking: false },
        /* Three picks of a dozen words, a sentence or two, and the JSON
           around them. The budget is the ceiling on how long a question can
           take. */
        max_tokens: 300
      });
    } catch (e) {
      /* The daily Neurons are spent, the model is overloaded, or it has
         been moved behind a paid plan. Two of those are worth nothing to a
         reader and are handled below as they always were; the first is
         worth saying out loud, because it is the one that will still be
         true in an hour and the only one somebody can do something about —
         come back tomorrow. */
      return { said: null, spent: String((e && e.message) || '').includes(SPENT) };
    }

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
    return { said: keep(unwrap(text), shown), spent: false };
  };

  let { said, spent } = await askModel(messages);

  /* The city's rule, enforced once rather than only asked for. Every answer
     with places on the city names at least one from my map and at least one
     from the rest of Tallinn; the prompt says so, and a small model still
     sometimes answers off one list — mine, usually, because my lines carry
     a dish and a write-up and Google's a rating, and a model asked for a
     reason reaches for the line it can give one from. So when an answer
     comes back off one list, the model is shown its own answer, told which
     list it skipped, and asked once more. The second answer stands whatever
     it is: a corrected mix, or an honest empty picks saying nothing on that
     list fits. One retry, only on a violation, so a compliant answer costs
     what it always did. */
  if (said && said.picks.length && wholeCity && google.length) {
    const mineIds = new Set(mine.map((p) => p.id));
    const hasMine = said.picks.some((p) => mineIds.has(p.id));
    const hasCity = said.picks.some((p) => !mineIds.has(p.id));
    if (!hasMine || !hasCity) {
      const skipped = hasCity ? 'MY MAP' : 'REST OF TALLINN';
      const again = await askModel(messages.concat(
        { role: 'assistant', content: JSON.stringify({ say: said.say, picks: said.picks }) },
        {
          role: 'user',
          content: 'That answer named no place from ' + skipped + '. The rule is at' +
            ' least one from MY MAP and at least one from REST OF TALLINN in' +
            ' every answer. Answer again with both, each with its reason — or,' +
            ' if truly nothing on ' + skipped + ' fits, say so and return an' +
            ' empty picks array.'
        }
      ));
      if (again.said) said = again.said;
      if (again.spent) spent = true;
    }
  }

  /* A broken answer is no answer: source "none", and the chat says nothing
     on the map answers that. An answer with a sentence and no places goes
     back as it is, source "ai", and the browser shows the sentence as the
     reply — the model saying "that is not a question about where to eat"
     is an answer in a chat. */
  /* Out of Neurons until midnight UTC. The browser draws this as the chat
     saying it is resting rather than as an answer, and does not fall through
     to its own keyword reader: three places matched on letters under a
     sentence about an evening is exactly the impersonation this whole
     feature has been trying to stop doing. */
  if (spent) return answer('resting', [], '', 'workers-ai-spent');

  if (!said) return answer('none', [], '', 'workers-ai-none');

  return answer('ai', said.picks, said.say, 'workers-ai');
}
