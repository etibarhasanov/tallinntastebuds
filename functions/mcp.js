/**
 * Tallinn Tastebuds — the map, read by an assistant.
 *
 * POST /mcp   one JSON-RPC 2.0 message    ->  one JSON-RPC 2.0 answer
 *             a notification              ->  202, nothing
 * GET, DELETE, anything else on /mcp      ->  405, Allow: POST
 *
 * The Model Context Protocol is how Claude, ChatGPT and the rest are handed
 * a tool: a server says what it can do, and a model calls it in the middle
 * of a conversation and reads the answer. This is that server for the map,
 * and it hands over two tools — search my places, read one — over the roll
 * in data/restaurants.json and nothing else. Somebody asks their assistant
 * for somewhere to eat in Tallinn and the assistant can ask the map, with
 * the write-up, the dish to order and the link to the place in the answer
 * it writes. Data only: no model of its own, no AI binding, no database, no
 * Google. Nothing a visitor to the site sees changes.
 *
 * It is added to an assistant as a custom connector by its address alone,
 * https://tallinntastebuds.ee/mcp — no key, no sign-in, no app to install.
 * **Read by an assistant** in README.md says how, and what it deliberately
 * leaves out.
 *
 * WHY MY PLACES ONLY
 *
 * The site holds two rolls and the difference is the point — the header of
 * /api/venues. The places in data/restaurants.json are places I have eaten
 * at and approved; the eleven hundred rows in `google_venues` are
 * Google's description of the city, with Google's ratings on them. A model
 * handed both would answer with Google's roll whenever mine fell short, under
 * this site's name, and the one thing the site promises is that being on the
 * map is the verdict: no scores, stars or rankings. So an assistant gets the
 * map and only the map — nothing out of the database, not a place id, not a
 * rating — and the server's own instructions tell it what the map is and what
 * it is not allowed to claim about it. Where the map has nothing that fits,
 * the right answer is that nothing on the map fits, and the tool says exactly
 * that rather than reaching for the rest of the city.
 *
 * WHY STATELESS
 *
 * The transport is the protocol's Streamable HTTP, which allows a server to
 * open a session on `initialize` — an `Mcp-Session-Id` the client sends back
 * on every request after — and to keep things between calls. A Pages
 * Function is an isolate that can be in any colo and remembers nothing from
 * one request to the next, so a session would be a row somewhere, and there
 * is nothing in this exchange worth a row: `initialize` says which tools
 * exist and a call answers out of a file both sides can read again tomorrow.
 * So no session is opened, no id is handed out, and every request is complete
 * on its own. A client that sends an id it got from somewhere else is
 * answered the same as one that sends none.
 *
 * WHY JSON ONLY
 *
 * The same transport lets a server answer with a stream of server-sent
 * events instead of one JSON body, for an answer that arrives in pieces, for
 * progress, for messages the server starts. A search over a few dozen rows
 * answers in one piece in a millisecond, and a stream to carry it would be a
 * connection held open for nothing on a plan that counts requests. So every
 * answer is one `application/json` body; a client asking to open the stream
 * with GET is told 405, which is how the protocol says a server declines it.
 * `Cache-Control: no-store` on all of it, because a JSON-RPC answer is to
 * one message and a cache has nothing to key it on.
 *
 * THE VERSIONS
 *
 * A client names the protocol version it speaks in `initialize`, and the
 * server answers with that one if it can speak it and with its newest if
 * not. VERSIONS below is what this one speaks, newest first: 2025-11-25 is
 * the current specification, and the two before it are what the clients
 * people actually run were built against. After `initialize` a client sends
 * the agreed version in an `MCP-Protocol-Version` header, and one naming a
 * version not in the list is answered 400, as the specification asks; one
 * with no header is assumed to be an older client and answered normally.
 * The batch of messages in one array that 2025-03-26 allowed was taken out
 * of the protocol in 2025-06-18, and this server never took one: an array
 * is answered with one invalid-request error whatever version is in play.
 *
 * WHAT A TOOL ANSWERS WITH
 *
 * Every call answers the same object twice, as `structuredContent` for a
 * client that reads JSON and as the same JSON in a text block for one that
 * reads only text, and each tool carries an `outputSchema` saying the shape.
 * A place is the row in data/restaurants.json with the write-up in the one
 * language asked for, the names under the protocol's conventions
 * (must_order, has_reel), and three things the file does not hold: the link
 * to the place on the map, the absolute address of its first photograph, and
 * on get_place a Google Maps *search* link built out of my own name and
 * address, which costs no Google data. An id that is not on the map, or a
 * place that has closed, is a tool result with `isError` and one plain
 * sentence rather than a protocol error, because that is an answer to the
 * question and not a fault in the asking.
 *
 * WHAT IS NOT HERE, ON PURPOSE
 *
 * No `Origin` check: the protocol asks a server on localhost to refuse a
 * browser's rebinding, and this one answers at a public hostname to clients
 * that are servers themselves. No rate limit past Cloudflare's own, no key,
 * nothing counted — this does not go through assets/track.js or /api/stats,
 * so an assistant's call is not a visit and appears on none of the owner's
 * pages. No resources, no prompts, no `tools/list` change notifications:
 * `capabilities` names tools and nothing else.
 *
 * functions/_middleware.js lets this address through untouched — it is on
 * the live hostname, under neither owner prefix, and the security headers go
 * on the answer the way they go on every Function's — and the two
 * subdomains 301 it back to the live hostname like every other page.
 */

import { json, mapPlaces, dataFile, languageIndex, nearTallinn, foldWords, km } from './api/_lib.js';
import { SITE } from './_shell.js';

/* Newest first: the one answered to a client that names none this server
   speaks. THE VERSIONS in the header. */
const VERSIONS = ['2025-11-25', '2025-06-18', '2025-03-26'];

const SERVER = { name: 'tallinntastebuds', version: '1.0.0' };

/* The language a write-up falls back to when the one asked for is missing,
   and the one a search is read in beside the asked-for one. The same
   constant is DEFAULT_LANG in functions/index.js and assets/app.js. */
const DEFAULT_LANG = 'en';

/* How many places a search answers with unless asked, and the most it will
   however it is asked: a model reading ten write-ups has read the map. */
const DEFAULT_LIMIT = 5;
const MAX_LIMIT = 10;

/* A query longer than this is a paragraph, and a paragraph's words match
   everything a little; the tool asks for a few words and holds to that. */
const MAX_QUERY = 200;

/* JSON-RPC 2.0's own codes, and the only ones this server uses. */
const PARSE_ERROR = -32700;
const INVALID_REQUEST = -32600;
const METHOD_NOT_FOUND = -32601;
const INVALID_PARAMS = -32602;
const INTERNAL_ERROR = -32603;

/* What the assistant is told about the map in `initialize`, before it has
   called anything. Short, because an assistant reads it once beside every
   other server it has, and firm about the one thing the site promises. */
const INSTRUCTIONS =
  'Tallinn Tastebuds is one person\'s map of places in Tallinn they have ' +
  'eaten at and approved. Being on the map is the verdict: there are no ' +
  'scores, stars or rankings, and the order places come back in is never ' +
  'one. So never describe a place as rated, ranked or recommended above ' +
  'another by Tallinn Tastebuds, and never say "best" on its behalf. ' +
  'Attribute the write-ups to Tallinn Tastebuds and always give the ' +
  'place\'s link (the url field). A search that finds nothing means ' +
  'nothing on the map fits; say so rather than guessing. Opening hours ' +
  'are not in this data: say they should be checked elsewhere.';

/* ------------------------------------------------------------ the tools
 * What tools/list hands over. The enums are read out of the deployment —
 * data/taxonomy.json for the kinds of place, data/lang/index.json for the
 * languages — so a type or a language added to the site is a type or a
 * language here without anybody remembering this file.
 */

/* The fields every place answers with, in both tools; get_place adds the
   rest of the row to them. The descriptions are read by a model deciding
   what to say, so they say what each number is. */
const PLACE_FIELDS = {
  id: { type: 'string', description: 'The place\'s id on the map, for get_place.' },
  name: { type: 'string' },
  address: { type: 'string', description: 'Street address in Tallinn.' },
  lat: { type: 'number' },
  lng: { type: 'number' },
  types: {
    type: 'array', items: { type: 'string' },
    description: 'The kinds of place it is, as ids: restaurant, coffee, date, cheap-eats and so on.'
  },
  price: {
    type: 'number', minimum: 1, maximum: 4,
    description: 'The map\'s own price scale: 1 is cheap, 4 is a tasting menu, and a half step is allowed.'
  },
  blurb: {
    type: 'string',
    description: 'Tallinn Tastebuds\' own write-up, in the language asked for, in English when it has none there.'
  },
  must_order: { type: 'array', items: { type: 'string' }, description: 'The dishes to order.' },
  url: { type: 'string', description: 'The place on the map. Always give it.' },
  photo: { type: ['string', 'null'], description: 'The first photograph of the place, or null when there is none.' },
  has_reel: { type: 'boolean', description: 'Whether there is a video of the place.' }
};

const SEARCH_FIELDS = {
  ...PLACE_FIELDS,
  distance_m: {
    type: 'integer',
    description: 'Metres from the point asked for, as the crow flies. Only when a point was given.'
  }
};

const DETAIL_FIELDS = {
  ...PLACE_FIELDS,
  reel: { type: ['string', 'null'], description: 'The video of the place, or null.' },
  photos: { type: 'array', items: { type: 'string' }, description: 'Every photograph, absolute addresses.' },
  phone: { type: ['string', 'null'] },
  website: { type: ['string', 'null'] },
  visited: { type: ['string', 'null'], description: 'When Tallinn Tastebuds ate there, as a month, or null.' },
  added: { type: ['string', 'null'], description: 'When the place joined the map, as a date.' },
  maps_url: {
    type: 'string',
    description: 'A Google Maps search for the place by its name and address, for directions and opening hours.'
  }
};

const languageParam = (langs) => ({
  type: 'string',
  enum: langs,
  default: DEFAULT_LANG,
  description: 'The language the write-up comes in: the ten the site speaks, as codes. ' +
    'A place with no write-up in it answers in English.'
});

/* Read-only, harmless to repeat, and over a closed list of places rather
   than the open world; the same four on both. */
const ANNOTATIONS = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };

function tools(types, langs) {
  return [
    {
      name: 'search_places',
      title: 'Search Tallinn Tastebuds',
      description:
        'Find places to eat or drink in Tallinn on Tallinn Tastebuds, one person\'s map of ' +
        'places they have eaten at and approved. Use it for any question about where to eat, ' +
        'drink coffee or go out in Tallinn: "somewhere for a date in Kalamaja", "cheap Asian ' +
        'food near the bus station", "a bakery in the old town". Pass a few words in `query`, ' +
        'not the whole question; pick a `type` when the question names a kind of place; give ' +
        '`near_lat` and `near_lng` when it names a point and the answer should be ordered by ' +
        'distance. Every filter is optional and they combine. An empty `places` list means ' +
        'nothing on the map fits, which is a real answer: do not fill it from elsewhere. The ' +
        'order is distance when a point was given and how well the words matched otherwise, ' +
        'never quality.',
      inputSchema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            maxLength: MAX_QUERY,
            description: 'A few words: a name, a street, a kind of place, a dish, a word from the ' +
              'write-up. Accents do not matter — "pohjala" finds Põhjala.'
          },
          type: {
            type: 'string',
            enum: types.map((t) => t.id),
            description: 'One kind of place: ' +
              types.map((t) => t.id + ' (' + t[DEFAULT_LANG] + ')').join(', ') + '.'
          },
          max_price: {
            type: 'number', minimum: 1, maximum: 4,
            description: 'Places at or under this on the map\'s own scale: 1 is cheap, 4 is a tasting menu.'
          },
          near_lat: { type: 'number', description: 'Latitude of a point in Tallinn to measure from. With near_lng.' },
          near_lng: { type: 'number', description: 'Longitude of that point. With near_lat.' },
          radius_m: {
            type: 'integer', minimum: 1,
            description: 'Only places within this many metres of the point. Needs near_lat and near_lng.'
          },
          language: languageParam(langs),
          limit: {
            type: 'integer', minimum: 1, maximum: MAX_LIMIT, default: DEFAULT_LIMIT,
            description: 'How many places at most.'
          }
        },
        additionalProperties: false
      },
      outputSchema: {
        type: 'object',
        properties: {
          places: { type: 'array', items: { type: 'object', properties: SEARCH_FIELDS } },
          note: { type: 'string', description: 'Present when nothing fits: one sentence saying so.' }
        },
        required: ['places']
      },
      annotations: ANNOTATIONS
    },
    {
      name: 'get_place',
      title: 'Read a place on Tallinn Tastebuds',
      description:
        'Everything Tallinn Tastebuds has on one place, by the id a search returned: the ' +
        'write-up, the dishes to order, every photograph, the video, the phone number and ' +
        'website, when it was visited, and a Google Maps link for directions and opening ' +
        'hours. Use it after search_places when the conversation turns to one place: "tell ' +
        'me more about Badam", "what should I order there". Opening hours are not in the ' +
        'answer.',
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'The place\'s id, as search_places gave it.' },
          language: languageParam(langs)
        },
        required: ['id'],
        additionalProperties: false
      },
      outputSchema: { type: 'object', properties: DETAIL_FIELDS },
      annotations: ANNOTATIONS
    }
  ];
}

/* ------------------------------------------------------------- a place
 * The row as a tool answers with it. The write-up in one language, the
 * dishes, and the three addresses the file does not carry: the place on the
 * map, its first photograph (a copy of photoOf() in functions/index.js, since
 * a route is not a module) and, on get_place, the Google Maps search.
 */
function photoUrl(place, photo) {
  return SITE + '/photos/' + encodeURIComponent(place.id) + '/' + encodeURIComponent(photo);
}

function entry(place, lang) {
  const photos = place.photos || [];
  return {
    id: place.id,
    name: place.name,
    address: place.address,
    lat: place.lat,
    lng: place.lng,
    types: place.types || [],
    price: place.price,
    blurb: place.blurb && (place.blurb[lang] || place.blurb[DEFAULT_LANG]) || '',
    must_order: place.mustOrder || [],
    url: SITE + '/?spot=' + encodeURIComponent(place.id),
    photo: photos.length ? photoUrl(place, photos[0]) : null,
    has_reel: !!place.reel
  };
}

function detail(place, lang) {
  return {
    ...entry(place, lang),
    reel: place.reel || null,
    photos: (place.photos || []).map((photo) => photoUrl(place, photo)),
    phone: place.phone || null,
    website: place.website || null,
    visited: place.visited || null,
    added: place.added || null,
    maps_url: 'https://www.google.com/maps/search/?api=1&query=' +
      encodeURIComponent(place.name + ', ' + place.address)
  };
}

/* ------------------------------------------------------------- a search
 * What a query's words are matched against, per place: the name, the kinds
 * of place in the asked-for language and in English, the dishes, the
 * street, and the write-up in both languages — folded the way the map's
 * find bar folds, so an accent typed or left out makes no difference. The
 * weights say where a word landing counts for more: a word in the name is
 * the place, a word in the write-up is a mention.
 */
const WEIGHTS = [['name', 4], ['kinds', 3], ['dishes', 3], ['where', 2], ['words', 1]];

function haystack(place, types, lang) {
  const kinds = (place.types || []).map((id) => {
    const type = types.find((t) => t.id === id);
    return type ? [type[lang], type[DEFAULT_LANG]].join(' ') : id;
  });
  const blurb = place.blurb || {};
  return {
    name: foldWords(place.name),
    kinds: foldWords(kinds.join(' ')),
    dishes: foldWords((place.mustOrder || []).join(' ')),
    where: foldWords(place.address),
    words: foldWords([blurb[lang], blurb[DEFAULT_LANG]].join(' '))
  };
}

/* The query as words: folded, split on anything that is not a letter or a
   digit, and the one-character pieces dropped, since "a" is in every name. */
function wordsOf(query) {
  return foldWords(query)
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w.length > 1);
}

function score(hay, words) {
  let total = 0;
  for (const word of words) {
    for (const [field, weight] of WEIGHTS) {
      if (hay[field].includes(word)) { total += weight; break; }
    }
  }
  return total;
}

function search(places, types, args) {
  const lang = args.language;
  const words = args.query ? wordsOf(args.query) : [];
  const at = args.at;
  let found = [];
  for (const place of places) {
    if (args.type && !(place.types || []).includes(args.type)) continue;
    if (args.max_price && place.price > args.max_price) continue;
    const far = at ? km(at, place) * 1000 : null;
    if (far !== null && args.radius_m && far > args.radius_m) continue;
    const hits = words.length ? score(haystack(place, types, lang), words) : 0;
    if (words.length && !hits) continue;
    found.push({ place, hits, far });
  }
  found.sort((a, b) => {
    if (at && a.far !== b.far) return a.far - b.far;
    if (b.hits !== a.hits) return b.hits - a.hits;
    const x = foldWords(a.place.name);
    const y = foldWords(b.place.name);
    return x < y ? -1 : x > y ? 1 : 0;
  });
  found = found.slice(0, args.limit);
  const out = {
    places: found.map((f) => {
      const row = entry(f.place, lang);
      if (at) row.distance_m = Math.round(f.far);
      return row;
    })
  };
  if (!out.places.length) {
    out.note = 'Nothing on the map fits that. Tallinn Tastebuds has no place matching ' +
      'those filters; say so rather than suggesting somewhere else as if it were on the map.';
  }
  return out;
}

/* ---------------------------------------------------------- the arguments
 * Each tool's arguments read off the call and held to the schema that was
 * sent, one message per thing wrong, so a model that passed a string for a
 * number is told which. Throws the message; the caller turns it into the
 * protocol's invalid-params error.
 */
function bad(message) {
  const e = new Error(message);
  e.invalid = true;
  return e;
}

function optionalString(args, key, max) {
  const value = args[key];
  if (value === undefined || value === null) return '';
  if (typeof value !== 'string') throw bad(key + ' must be a string');
  return value.slice(0, max);
}

function optionalNumber(args, key) {
  const value = args[key];
  if (value === undefined || value === null) return null;
  if (typeof value !== 'number' || !Number.isFinite(value)) throw bad(key + ' must be a number');
  return value;
}

function language(args, langs) {
  const value = optionalString(args, 'language', 8);
  if (!value) return DEFAULT_LANG;
  if (!langs.includes(value)) throw bad('language must be one of ' + langs.join(', '));
  return value;
}

function searchArgs(raw, types, langs) {
  const type = optionalString(raw, 'type', 40);
  if (type && !types.some((t) => t.id === type)) {
    throw bad('type must be one of ' + types.map((t) => t.id).join(', '));
  }
  const maxPrice = optionalNumber(raw, 'max_price');
  if (maxPrice !== null && (maxPrice < 1 || maxPrice > 4)) throw bad('max_price must be 1 to 4');
  const lat = optionalNumber(raw, 'near_lat');
  const lng = optionalNumber(raw, 'near_lng');
  if ((lat === null) !== (lng === null)) throw bad('near_lat and near_lng go together');
  if (lat !== null && !nearTallinn(lat, lng)) throw bad('near_lat and near_lng are not in Tallinn');
  const radius = optionalNumber(raw, 'radius_m');
  if (radius !== null && lat === null) throw bad('radius_m needs near_lat and near_lng');
  if (radius !== null && radius < 1) throw bad('radius_m must be at least 1');
  const limit = optionalNumber(raw, 'limit');
  return {
    query: optionalString(raw, 'query', MAX_QUERY),
    type,
    max_price: maxPrice,
    at: lat === null ? null : { lat, lng },
    radius_m: radius,
    language: language(raw, langs),
    limit: limit === null ? DEFAULT_LIMIT : Math.min(MAX_LIMIT, Math.max(1, Math.floor(limit)))
  };
}

/* ------------------------------------------------------------- the calls
 * The protocol's tool result: the object twice, or a sentence with isError
 * on it. search() above is the one tool; get_place is here.
 */
function toolResult(object) {
  return { content: [{ type: 'text', text: JSON.stringify(object) }], structuredContent: object };
}

function toolError(sentence) {
  return { content: [{ type: 'text', text: sentence }], isError: true };
}

function getPlace(raw, places, all, langs) {
  const id = optionalString(raw, 'id', 80);
  if (!id) throw bad('id is required');
  const lang = language(raw, langs);
  const place = places.find((p) => p.id === id);
  if (place) return toolResult(detail(place, lang));
  const closed = all.find((p) => p.id === id);
  return toolError(closed
    ? closed.name + ' has closed and is no longer on the map.'
    : 'There is no place with the id "' + id + '" on the map.');
}

/* ----------------------------------------------------------- the protocol
 * One message in, one answer out. The answer to a request carries its id;
 * a notification — no id — and a response the client sends are 202 with no
 * body, as the transport says.
 */
function reply(id, result) {
  return json({ jsonrpc: '2.0', id, result });
}

function fail(id, code, message, status, data) {
  const error = { code, message };
  if (data !== undefined) error.data = data;
  return json({ jsonrpc: '2.0', id: id === undefined ? null : id, error }, status);
}

function accepted() {
  return new Response(null, {
    status: 202,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
  });
}

async function answer(context, message) {
  const id = message.id;
  const params = message.params && typeof message.params === 'object' ? message.params : {};

  if (message.method === 'initialize') {
    const asked = typeof params.protocolVersion === 'string' ? params.protocolVersion : '';
    return reply(id, {
      protocolVersion: VERSIONS.includes(asked) ? asked : VERSIONS[0],
      capabilities: { tools: {} },
      serverInfo: SERVER,
      instructions: INSTRUCTIONS
    });
  }

  if (message.method === 'ping') return reply(id, {});

  if (message.method !== 'tools/list' && message.method !== 'tools/call') {
    return fail(id, METHOD_NOT_FOUND, 'Method not found: ' + message.method);
  }

  /* Both of the rest read the deployment: the roll, the kinds of place and
     the languages, each five minutes per isolate through _lib.js. */
  const [all, taxonomy, index] = await Promise.all([
    mapPlaces(context),
    dataFile(context, '/data/taxonomy.json'),
    languageIndex(context)
  ]);
  const types = taxonomy.types;
  const langs = Object.keys(index);

  if (message.method === 'tools/list') return reply(id, { tools: tools(types, langs) });

  const name = typeof params.name === 'string' ? params.name : '';
  const args = params.arguments && typeof params.arguments === 'object' && !Array.isArray(params.arguments)
    ? params.arguments
    : {};
  const places = all.filter((p) => !p.closed);
  try {
    if (name === 'search_places') return reply(id, toolResult(search(places, types, searchArgs(args, types, langs))));
    if (name === 'get_place') return reply(id, getPlace(args, places, all, langs));
  } catch (e) {
    if (e.invalid) return fail(id, INVALID_PARAMS, e.message);
    throw e;
  }
  return fail(id, INVALID_PARAMS, 'Unknown tool: ' + name, 200, { tools: ['search_places', 'get_place'] });
}

export async function onRequest(context) {
  const request = context.request;

  if (request.method !== 'POST') {
    return new Response(null, {
      status: 405,
      headers: { allow: 'POST', 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
    });
  }

  const spoken = request.headers.get('MCP-Protocol-Version');
  if (spoken && !VERSIONS.includes(spoken)) {
    return fail(null, INVALID_REQUEST, 'Unsupported MCP-Protocol-Version: ' + spoken, 400, { supported: VERSIONS });
  }

  let message;
  try {
    message = JSON.parse(await request.text());
  } catch (e) {
    return fail(null, PARSE_ERROR, 'Parse error: the body is not JSON');
  }

  if (Array.isArray(message)) {
    return fail(null, INVALID_REQUEST, 'Batches are not supported: send one message per request');
  }
  if (!message || typeof message !== 'object' || message.jsonrpc !== '2.0') {
    return fail(null, INVALID_REQUEST, 'Invalid request: one JSON-RPC 2.0 message is expected');
  }

  /* A notification, or the client's answer to something: nothing to say
     back, and the transport wants a 202 with no body. A request whose id is
     the wrong shape is refused rather than mistaken for one. */
  if (!('id' in message)) {
    if (typeof message.method === 'string' || 'result' in message || 'error' in message) return accepted();
    return fail(null, INVALID_REQUEST, 'Invalid request: no method');
  }
  if (typeof message.id !== 'string' && typeof message.id !== 'number') {
    return fail(null, INVALID_REQUEST, 'Invalid request: id must be a string or a number');
  }
  if (typeof message.method !== 'string') {
    return fail(message.id, INVALID_REQUEST, 'Invalid request: no method');
  }

  try {
    return await answer(context, message);
  } catch (e) {
    /* The roll or a data file missing from the deployment is a broken
       build, not a bad question; say so in the protocol's own words rather
       than as a Worker's 500. */
    return fail(message.id, INTERNAL_ERROR, 'The map could not be read: ' + (e && e.message ? e.message : e), 500);
  }
}
