/**
 * Tallinn Tastebuds — the chat answered by Claude, when there is a key for it.
 *
 * Underscore-prefixed files under functions/ are not routed, so this is a
 * module and never an endpoint. Its one caller is /api/ask.
 *
 * WHY THERE IS A SECOND MODEL AT ALL
 *
 * Workers AI is free and bound by name, and for a year it was the whole of
 * this feature. What it is not is a conversation. The free allowance is ten
 * thousand Neurons a day, which is something like three hundred questions
 * once the catalogue is narrowed — see shortlist() in ask.js — and past that
 * every request is a 429, /api/ask answers `source: "none"`, and the
 * browser's keyword reader answers instead, which matches substrings and
 * cannot hold a thread. "How does it work" came back with three restaurants
 * because of exactly that, and no amount of work on the reader fixes it,
 * because the reader is a substring matcher and the ask is for a
 * conversation.
 *
 * So when ANTHROPIC_API_KEY is set in the Pages environment this answers
 * first and Workers AI becomes the fallback. Without the key nothing here
 * runs and the route behaves exactly as it did.
 *
 * WHY fetch AND NOT THE SDK
 *
 * @anthropic-ai/sdk is the right way to call this API in almost any other
 * project, and it is the wrong way here: there is no package.json, no
 * node_modules and no build step in this repository, and CLAUDE.md is
 * explicit that a change wanting a bundler is the wrong change. Pages would
 * have to build a dependency graph for one HTTPS call. So this is `fetch`
 * against the Messages API, which is what the runtime already has.
 *
 * WHAT IS CACHED, AND WHY THE SPLIT IS THE WHOLE COST STORY
 *
 * The catalogue is the same seventy lines on every question ever asked, and
 * it is most of the prompt. It goes in `system` under a `cache_control`
 * breakpoint, so it is written once and read back at the cache rate after
 * that; Claude Opus 5 caches a prefix from 512 tokens and the catalogue is
 * several thousand, so it qualifies comfortably.
 *
 * A cache is a prefix match, which is what decides the shape below: anything
 * that changes between two questions has to sit *after* the breakpoint or it
 * invalidates the catalogue behind it. Two things change. The opening hours
 * change through the evening — so they are named in the question's own turn
 * and never in the catalogue, which is why catalogueFor() in ask.js is
 * called with no `open` map. And the forty Google rows are narrowed to each
 * question — so they ride in the same turn. Put either in `system` and the
 * catalogue is re-read at full price every time, silently: it still answers,
 * it just costs several times more.
 */

/* Claude Opus 5. The most capable model in the family that is not priced
   above Opus tier, and this is a chat a stranger judges the site by.
   `claude-haiku-4-5` is the one-line change to something around five times
   cheaper and noticeably less good at a sentence; it is a decision about
   money rather than about code, so it is left to whoever holds the key. */
const MODEL = 'claude-opus-5';

/* Room for the answer and for the thinking in front of it.
 *
 * Thinking is on by default on this model and its tokens are drawn from this
 * budget, so this is not the size of the answer — the answer is three ids, a
 * clause each and a sentence, a couple of hundred tokens at most. It is the
 * headroom that stops a model that thought a little too long from being cut
 * off mid-JSON and thrown away. That exact failure is written into the
 * header of ask.js about the first Workers AI model this feature ran on, and
 * it cost a day to find; four thousand is far more than low effort has ever
 * needed and costs nothing when it goes unused, because output is billed on
 * what is written rather than on what was allowed. */
const MAX_TOKENS = 4000;

/* The answer's shape, enforced rather than asked for. With this set the
   first text block of the reply is valid JSON of exactly this shape, so
   there is no fenced ```json to unwrap and no sentence written in front of
   it — the two failures unwrap() in ask.js exists to survive on the Workers
   AI path. `additionalProperties: false` and a full `required` list are what
   the strict validator wants. */
const FORMAT = {
  type: 'json_schema',
  schema: {
    type: 'object',
    properties: {
      say: { type: 'string' },
      picks: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            why: { type: 'string' }
          },
          required: ['id', 'why'],
          additionalProperties: false
        }
      }
    },
    required: ['say', 'picks'],
    additionalProperties: false
  }
};

/* The instructions, and then the catalogue under them. Byte-identical for
   every question asked in a given language, which is what makes it worth a
   cache breakpoint — see the header. Nothing about the moment goes in here:
   not the hours, not the Google rows, not the question. */
function systemFor(catalogue, lang, maxPicks) {
  return [
    'You are the voice of Tallinn Tastebuds, a map of places to eat in Tallinn' +
      ' that one person has been to and written up. You are chatting with a' +
      ' visitor about where they should eat.',
    '',
    'Talk like a person who knows the city: warm, brief, specific. This is a' +
      ' conversation and not a search box, so a follow-up like "somewhere' +
      ' cheaper" or "what is similar to that" means what it would mean to a' +
      ' person, read against what you just said.',
    '',
    'Answer with between one and ' + maxPicks + ' places, best first — only as' +
      ' many as genuinely answer them. One is a complete answer; never pad to' +
      ' ' + maxPicks + '.',
    '',
    'Never invent a place. Every id must be copied exactly from the lists you' +
      ' are given, and you never say anything about a place beyond what its' +
      ' line says.',
    '',
    'If the message is not asking for somewhere to eat — a greeting, thanks,' +
      ' "how does it work", "what is this" — just answer it, in one short' +
      ' friendly sentence, with an empty picks array. Asked how it works, say' +
      ' something like: by asking what you feel like eating, a dish or a mood' +
      ' or a budget, and I will pick somewhere for it. Never answer a question' +
      ' like that with restaurants.',
    '',
    'If nothing on the lists fits, say so plainly with an empty picks array,' +
      ' or ask what they meant. A shrug is better than a place that does not' +
      ' answer them.',
    '',
    'Write "say" as one or two short sentences.',
    '',
    'EVERY pick must carry a "why", and it is never empty — a place appearing' +
      ' with no reason under it is the one thing this must not do. Write it as' +
      ' at most twelve words on why THAT place answers THIS question: the dish' +
      ' they asked for, the reason it suits the occasion, what makes it the' +
      ' cheap one. Never a description of the place and never its type or' +
      ' price read back — the card under it already prints those, and repeating' +
      ' them is the row explaining itself with itself.',
    '',
    'Write everything in this language: ' + lang + '.',
    '',
    'Places I have eaten at and written up:',
    'id | name | types | price out of 4 | must order | description',
    catalogue
  ].join('\n');
}

/* Everything about this moment: what is open, the slice of Google's export
   this question could be about, how far the visitor said to reach, and the
   question itself. After the breakpoint, all of it — see the header.
 *
 * `google` arrives already formatted, by the same googleFor() in ask.js that
 * lays those rows out for Workers AI. One formatter rather than one per
 * model: they want the identical thing, and two would be two to keep in step
 * every time a column is added to the export. */
function askTurn(question, google, wholeCity, open) {
  const lines = [];

  const openIds = Object.keys(open || {});
  if (openIds.length) {
    lines.push(
      'Open in Tallinn right now, and until when: ' +
        openIds.map((id) => id + ' until ' + open[id]).join(', '),
      ''
    );
  }

  if (google) {
    lines.push(
      wholeCity
        ? 'Places from Google that I have NOT been to and have no opinion on.' +
          ' Prefer one of mine above when it answers as well; use these when' +
          ' one of them answers better:'
        : 'Places from Google that I have NOT been to. Use one ONLY if nothing' +
          ' in my own list answers the question at all:',
      'id | name | types and cuisine | price out of 4 | Google rating',
      google,
      ''
    );
  }

  lines.push(question);
  return lines.join('\n');
}

/* The conversation as the API takes it: the earlier exchanges as the turns
   they were, the answers in the same JSON they were written in, and this
   question last with the moment attached to it. */
function messagesFor(question, history, google, wholeCity, open) {
  const messages = [];

  for (const turn of history) {
    messages.push({ role: 'user', content: turn.q });
    messages.push({
      role: 'assistant',
      content: JSON.stringify({ say: turn.say, picks: turn.picks })
    });
  }

  messages.push({ role: 'user', content: askTurn(question, google, wholeCity, open) });
  return messages;
}

/* ------------------------------------------------------------------- ask
 * One question, answered — or null, and the caller falls back.
 *
 * Every failure returns null rather than throwing: a key that has expired, a
 * spending cap reached, a network that is gone. The route above turns that
 * into Workers AI and then into the browser's own reader, so the map never
 * sits there apologising. `note` on the way out says which of them it was,
 * as a short code, because the whole reason this feature was silent for a
 * day is that every failure looked identical from the outside.
 */
export async function askClaude(env, { question, history, catalogue, google, wholeCity, lang, open, maxPicks }) {
  const key = env.ANTHROPIC_API_KEY;
  if (!key) return { ok: false, note: 'no-key' };

  let res;
  try {
    res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        /* The catalogue, cached. The breakpoint goes on the last block of the
           stable prefix, and this is the only block. */
        system: [
          {
            type: 'text',
            text: systemFor(catalogue, lang, maxPicks),
            cache_control: { type: 'ephemeral' }
          }
        ],
        messages: messagesFor(question, history, google, wholeCity, open),
        /* Low effort, and thinking left on. Choosing three lines out of a
           list is not a thing to deliberate over, and low is what the model
           is given for a task of this size; leaving thinking on rather than
           disabling it is deliberate, because a disabled-thinking Opus 5
           sometimes writes its answer as prose instead of as the structured
           output asked for, which here would be an answer thrown away. */
        output_config: { effort: 'low', format: FORMAT }
      })
    });
  } catch (e) {
    return { ok: false, note: 'network' };
  }

  if (!res.ok) {
    /* 401 a bad key, 429 a rate or spend limit, 529 overloaded. The status is
       enough to act on and the body may quote the request back, so it is not
       carried any further than this. */
    return { ok: false, note: 'http-' + res.status };
  }

  let body;
  try {
    body = await res.json();
  } catch (e) {
    return { ok: false, note: 'unreadable' };
  }

  /* Thinking blocks come first in the content array, so the answer is the
     first text block rather than the first block. With output_config.format
     set it is valid JSON of the shape above. */
  const block = (body.content || []).find((part) => part && part.type === 'text');
  if (!block) return { ok: false, note: 'no-text' };

  let said;
  try {
    said = JSON.parse(block.text);
  } catch (e) {
    return { ok: false, note: 'bad-json' };
  }

  return { ok: true, said, note: 'claude' };
}
