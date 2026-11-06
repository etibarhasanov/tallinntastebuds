/**
 * Tallinn Tastebuds — the map, read by an assistant.
 *
 * POST /mcp   one JSON-RPC 2.0 message    ->  one JSON-RPC 2.0 answer
 *             a notification              ->  202, nothing
 * OPTIONS     a browser's preflight       ->  204, the CORS headers
 * GET, DELETE, anything else on /mcp      ->  405, Allow: POST, OPTIONS
 *
 * The Model Context Protocol is how Claude, ChatGPT and the rest are handed
 * a tool: a server says what it can do, and a model calls it in the middle
 * of a conversation and reads the answer. This is that server for the map,
 * and it hands over two tools: `places`, which searches my places or reads
 * one, over the roll in data/restaurants.json, and `lists`, which searches
 * the public lists or reads one, out of the database the lists page reads.
 * Somebody asks their assistant for
 * somewhere to eat in Tallinn, or for a top ten of bakeries, and the
 * assistant can ask the site, with the write-up, the dish to order, whose
 * list it is and the link in the answer it writes. Reads only: no model of
 * its own, no AI binding, no write to anything. Nothing a visitor to the site
 * sees changes.
 *
 * It is added to an assistant as a custom connector by its address alone,
 * https://tallinntastebuds.ee/mcp — no key, no sign-in, no app to install.
 * **Read by an assistant** in README.md says how, and what it deliberately
 * leaves out.
 *
 * WHOSE PLACES, AND WHOSE LISTS
 *
 * The site holds two rolls and the difference is the point — the header of
 * /api/venues. The places in data/restaurants.json are places I have eaten
 * at and approved; the eleven hundred rows in `google_venues` are the rest
 * of the city, as the Places export describes it. The one thing the site
 * promises is that being on the map is the verdict: no scores, stars or
 * rankings. So `places` answers out of the map and only the map, and
 * where the map has nothing that fits it says exactly that rather than
 * reaching for the rest of the city.
 *
 * The lists are the other kind of thing the site has: somebody's opinion,
 * under their name, in the order they put it in — **Lists** in README.md.
 * A "top 10" there is its author's top ten and never the map's verdict, and
 * the six under `google-statistics` are Google's ratings under Google's
 * name. So `lists` answers with whose list it is on every
 * one, and the instructions tell the assistant to say so. Only public lists
 * of four places or more, the floor the lists page holds them to; a private
 * list and an id that does not exist are the same sentence, as they are on
 * the page, so the tool cannot be used to learn which codes are real.
 *
 * A place on a list that is not on my map is one out of the export or one
 * somebody added by hand, and it answers with its name, its address and its
 * point. Those are facts about the place, the same ones the list page draws,
 * and the owner's decision was that they go to an assistant the same way.
 * What does not go is anything the export says *about* a place — its
 * rating, its reviews — except where a list's author wrote it into their own
 * sentence, which is what Google's six lists are.
 *
 * WHY TWO TOOLS, AND NOT FOUR
 *
 * There were four — search_places, get_place, search_lists, get_list — and
 * each was its own "Claude wants to use…" card the first time it was
 * called, so somebody who had just added the connector approved four times
 * before the map had answered one question whole. A server cannot switch
 * that card off: readOnlyHint below is the only thing it can say, and the
 * client still asks once per tool. So the tools are cut to two, and the
 * line between them is the line in WHOSE PLACES above: `places` is the
 * map's verdict, `lists` is somebody's opinion under their name, and an
 * assistant that has to keep the two apart is helped by their being two
 * things to call. One tool would have been one card, and a single
 * description in which a member's top ten and my map sit side by side.
 * Each searches unless it is handed an `id`, and then reads that one whole;
 * both answer with an array — `places` or `lists` — of one row or several,
 * so the shape does not change with the question. The old four names are
 * still answered on tools/call for a client that read the list before the
 * change and has not read it again, and are listed nowhere.
 *
 * AND CHATGPT'S TWO
 *
 * ChatGPT uses a connector in three places — a chat with Developer mode on,
 * Deep Research, and its company-knowledge search — and only the first will
 * call any tool it is handed. The other two call exactly two, named `search`
 * and `fetch`, in a shape OpenAI fixed: `search` takes one `query` and
 * answers `{results: [{id, title, url}]}`, `fetch` takes one of those ids
 * and answers `{id, title, text, url, metadata}`, each as JSON in a text
 * block. A connector without them is refused there, and on a plan without
 * Developer mode it is refused everywhere. So they are listed too, over the
 * map and only the map — the lists are somebody's opinion, and a pair of
 * tools with one query box and no author field is no place to keep that
 * apart — and they are the cost the owner chose to pay for ChatGPT: in
 * Claude, two more permission cards if it ever calls them. Their
 * descriptions point it at `places` instead, which takes the filters.
 * `fetch`'s `text` is the write-up in sentences, with the dishes, the price
 * and the link, because a research model reads text and quotes it.
 *
 * WHY STATELESS
 *
 * The transport is the protocol's Streamable HTTP, which allows a server to
 * open a session on `initialize` — an `Mcp-Session-Id` the client sends back
 * on every request after — and to keep things between calls. A Pages
 * Function is an isolate that can be in any colo and remembers nothing from
 * one request to the next, so a session would be a row somewhere, and there
 * is nothing in this exchange worth a row: `initialize` says which tools
 * exist and a call answers out of a file or a table both sides can read
 * again tomorrow.
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
 * WHERE THE PERSON IS
 *
 * Neither Claude nor ChatGPT hands a connector the phone's position, and the
 * protocol has no field for one: a server is sent only what the model writes
 * into the call. So "food close to my place" arrived with no point, and the
 * first assistant to be asked it asked back for a street before searching —
 * correct, and a question where the owner wanted an answer. The assistant is
 * told instead to fill the point itself, every time where the person is
 * matters: the street or area they named, anything earlier in the
 * conversation, or the rough location its own app gives it, and the middle
 * of Tallinn when it has nothing finer — then to search, say which point it
 * measured from, and invite a street only to make the answer closer. That is
 * words in INSTRUCTIONS and in the search tool's description, not a field:
 * the server cannot tell an estimate from a position and does not try, and
 * it turns no typed street into a point itself, which would be a call to a
 * geocoder from a server that otherwise asks nobody anything.
 *
 * WHAT A TOOL ANSWERS WITH
 *
 * Every call answers the same object twice, as `structuredContent` for a
 * client that reads JSON and as the same JSON in a text block for one that
 * reads only text, and each tool carries an `outputSchema` saying the shape.
 * A place is the row in data/restaurants.json with the write-up in the one
 * language asked for, the names under the protocol's conventions
 * (must_order, has_reel), the link to its Instagram video where it has one
 * in every row and not only on a place read whole — the video is the one
 * thing a write-up cannot do, so an assistant answering "where should I eat"
 * should be able to hand it over without a second call — and three things
 * the file does not hold: the link to the place on the map, the absolute
 * address of its first photograph, and on a place read by its id a Google
 * Maps *search* link built out of my own name and address, which costs no
 * Google data. An id that is not on the
 * map, or a place that has closed, is a tool result with `isError` and one
 * plain sentence rather than a protocol error, because that is an answer to
 * the question and not a fault in the asking. A list is its title, its
 * author, the line under it and its link, and a list read by its id adds
 * every place in the author's order in the author's words; a list that is
 * private or missing is the same kind of sentence.
 *
 * WHAT IS NOT HERE, ON PURPOSE
 *
 * No `Origin` check: the protocol asks a server on localhost to refuse a
 * browser's rebinding, and this one answers at a public hostname to clients
 * that are servers themselves — and to the few that are a web page, the MCP
 * Inspector in a browser or a playground, which is why every answer carries
 * `Access-Control-Allow-Origin: *` and OPTIONS answers a preflight. Nothing
 * here reads a cookie or a credential, so any page may read what any server
 * may. No rate limit past Cloudflare's own, no key,
 * nothing counted — this does not go through assets/track.js or /api/stats,
 * so an assistant's call is not a visit and appears on none of the owner's
 * pages, and a list it reads is not an open: the order the lists page opens
 * on is what people did, and an assistant reading a list a hundred times
 * must not be able to move it. No resources, no prompts, no `tools/list` change notifications:
 * `capabilities` names tools and nothing else.
 *
 * functions/_middleware.js lets this address through untouched — it is on
 * the live hostname, under neither owner prefix, and the security headers go
 * on the answer the way they go on every Function's — and the two
 * subdomains 301 it back to the live hostname like every other page.
 */

import { json, mapPlaces, dataFile, languageIndex, nearTallinn, foldWords, km, wrongDatabase } from './api/_lib.js';
import { readList, LIST_ID } from './api/_lists.js';
import { MIN_ITEMS } from './api/_mostkept.js';
import { SITE } from './_shell.js';

/* Newest first: the one answered to a client that names none this server
   speaks. THE VERSIONS in the header. */
const VERSIONS = ['2025-11-25', '2025-06-18', '2025-03-26'];

/* How the server introduces itself in `initialize`. `name` is the id a
   client keys it on and stays as it was; the title, the line under it, the
   site and the icons are 2025-11-25's, and what Claude and ChatGPT draw in
   their list of connectors in place of a bare id and a grey square. An
   older client ignores them. The icons are the site's own, the files the
   pages' <link rel="icon"> name. */
const SERVER = {
  name: 'tallinntastebuds',
  title: 'Tallinn Tastebuds',
  version: '1.1.0',
  description: 'One person\'s map of places to eat and drink in Tallinn, and the lists its members make.',
  websiteUrl: SITE,
  icons: [
    { src: SITE + '/assets/logo/icon-192.png', mimeType: 'image/png', sizes: ['192x192'] },
    { src: SITE + '/assets/logo/icon-48.png', mimeType: 'image/png', sizes: ['48x48'] }
  ]
};

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
  'are not in this data: say they should be checked elsewhere. ' +
  'When a place has a reel, it is a short video of the place on ' +
  'Instagram: give it beside the place\'s link as one to watch, ' +
  '"watch the video on Instagram", so the person can see the place ' +
  'and the food before they go. ' +
  'Whenever where the person is matters to the answer — near me, close ' +
  'to my place, around here, or a street or area they named — fill ' +
  'near_lat and near_lng yourself rather than asking first: the place ' +
  'they named, anything earlier in the conversation, or the location ' +
  'your app gives you, and the middle of Tallinn (59.437, 24.7536) when ' +
  'you have nothing finer. Then say in one line which point you measured ' +
  'from, and that naming a street would make it closer. ' +
  'The lists (the lists tool) are something else: public lists ' +
  'members of the site have made, each under its author\'s name. A list\'s ' +
  'title and order are its author\'s opinion, not Tallinn Tastebuds\' ' +
  'verdict, so say whose list it is ("on etibar\'s list") and give the ' +
  'list\'s link. Lists by google-statistics are Google\'s ratings, under ' +
  'Google\'s name: say so. A place on a list with on_map false has no ' +
  'write-up from Tallinn Tastebuds.';

/* ------------------------------------------------------------ the tools
 * What tools/list hands over. The enums are read out of the deployment —
 * data/taxonomy.json for the kinds of place, data/lang/index.json for the
 * languages — so a type or a language added to the site is a type or a
 * language here without anybody remembering this file.
 */

/* The fields every place answers with, searched for or read by its id,
   which adds the rest of the row to them. The descriptions are read by a model deciding
   what to say, so they say what each number is. */
const PLACE_FIELDS = {
  id: { type: 'string', description: 'The place\'s id on the map: pass it back as `id` to read the place whole.' },
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
  reel: {
    type: ['string', 'null'],
    description: 'A short video of the place on Instagram, or null. When there is one, give it as a link to watch.'
  },
  has_reel: { type: 'boolean', description: 'Whether there is a video of the place: reel is not null.' }
};

const SEARCH_FIELDS = {
  ...PLACE_FIELDS,
  distance_m: {
    type: 'integer',
    description: 'Metres from the point asked for, as the crow flies. Only when a point was given.'
  }
};

/* What a place read by its id adds to a search row. */
const DETAIL_FIELDS = {
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
  description: 'The language the write-up comes in: the languages the site speaks, as codes. ' +
    'A place with no write-up in it answers in English.'
});

/* What a list answers with, searched for or read by its id, which adds its
   places. */
const LIST_FIELDS = {
  id: { type: 'string', description: 'The list\'s id: pass it back as `id` to read the list whole.' },
  title: { type: 'string', description: 'The title its author gave it.' },
  intro: { type: 'string', description: 'The line its author wrote under the title, or empty.' },
  by: { type: ['string', 'null'], description: 'Whose list it is: the author\'s username. Always say it.' },
  places: { type: 'integer', description: 'How many places are on it.' },
  url: { type: 'string', description: 'The list on Tallinn Tastebuds. Always give it.' }
};

const LIST_PLACE_FIELDS = {
  position: { type: 'integer', description: 'Where its author put it, from 1.' },
  name: { type: 'string' },
  note: { type: ['string', 'null'], description: 'What the list\'s author wrote about it, or null.' },
  must_order: { type: ['string', 'null'], description: 'What the author says to order there, or null.' },
  address: { type: ['string', 'null'] },
  lat: { type: ['number', 'null'] },
  lng: { type: ['number', 'null'] },
  on_map: {
    type: 'boolean',
    description: 'Whether it is also on the Tallinn Tastebuds map. When it is, place_id read through the places tool gives the place whole.'
  },
  place_id: { type: ['string', 'null'], description: 'The map\'s id for it when on_map, else null.' },
  reel: {
    type: ['string', 'null'],
    description: 'A short video of the place on Instagram when on_map and there is one, else null. Give it as a link to watch.'
  },
  closed: { type: 'boolean', description: 'Present and true when the map has it as closed.' },
  url: {
    type: 'string',
    description: 'The place on the map when on_map, else a Google Maps search for it by name and address.'
  }
};

/* Read-only, harmless to repeat, and over the site's own data rather than
   the open world; the same four on all of them. */
const ANNOTATIONS = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };

function tools(types, langs) {
  return [
    {
      name: 'places',
      title: 'Places on Tallinn Tastebuds',
      description:
        'Find places to eat or drink in Tallinn on Tallinn Tastebuds, one person\'s map of ' +
        'places they have eaten at and approved, or read one of them whole. Use it for any ' +
        'question about where to eat, drink coffee or go out in Tallinn: "somewhere for a date ' +
        'in Kalamaja", "cheap Asian food near the bus station", "a bakery in the old town". ' +
        'Pass a few words in `query`, not the whole question; pick a `type` when the question ' +
        'names a kind of place. Whenever where the person is matters — "food close to my ' +
        'place", "coffee around here", "near Balti jaam" — fill `near_lat` and `near_lng` with ' +
        'your best estimate rather than asking first: the street or area named, the location ' +
        'your app gives you, or the middle of Tallinn (59.437, 24.7536) when you have nothing ' +
        'finer; then say which point you measured from. Leave them out when the question names ' +
        'a place to look up. Every filter is optional and they combine. An empty `places` list ' +
        'means nothing on the map fits, which is a real answer: do not fill it from elsewhere. ' +
        'The order is distance when a point was given and how well the words matched ' +
        'otherwise, never quality. When the conversation turns to one place — "tell me more ' +
        'about Badam", "what should I order there" — pass its `id` instead, and the one place ' +
        'comes back with every photograph, the phone number and website, when it ' +
        'was visited, and a Google Maps link for directions; the filters are ignored then. ' +
        'Opening hours are not in the answer.',
      inputSchema: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'Read this one place whole, by the id an earlier answer gave. Leave it out to search.'
          },
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
          near_lat: {
            type: 'number',
            description: 'Latitude of where the person is, or your best estimate of it, in Tallinn. With near_lng.'
          },
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
          places: {
            type: 'array',
            description: 'The places found, or the one place asked for by id with every field below.',
            items: { type: 'object', properties: { ...SEARCH_FIELDS, ...DETAIL_FIELDS } }
          },
          note: { type: 'string', description: 'Present when nothing fits: one sentence saying so.' }
        },
        required: ['places']
      },
      annotations: ANNOTATIONS
    },
    {
      name: 'lists',
      title: 'Lists on Tallinn Tastebuds',
      description:
        'Find public lists on Tallinn Tastebuds, or read one of them whole: lists of places in ' +
        'Tallinn that members of the site have made, each somebody\'s own picks under their ' +
        'name — "top 10 coffee", "best places to work with laptop", "best beer bars" — and six ' +
        'lists of Google\'s ratings under the name google-statistics. Use it when the question ' +
        'asks for a list, a top ten or somebody\'s picks: "a top 10 bakery list", "where do ' +
        'locals say to drink beer". Pass a word or two in `query`, not the whole question; give ' +
        '`by` for one author\'s lists. Each result says whose list it is and its first few ' +
        'places. An empty `lists` means no list fits. When the conversation turns to one list ' +
        '— "show me that bakery list", "what is on etibar\'s coffee list" — pass its `id`, and ' +
        'it comes back with every place in the order its author put them, what the author ' +
        'wrote about each, its address and point, and whether it is also on the Tallinn ' +
        'Tastebuds map. The order is the author\'s, not the site\'s.',
      inputSchema: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'Read this one list whole, by the id an earlier answer gave. Leave it out to search.'
          },
          query: {
            type: 'string',
            maxLength: MAX_QUERY,
            description: 'A word or two, matched against the title, the line under it, the author ' +
              'and the places on it. Accents do not matter.'
          },
          by: { type: 'string', maxLength: 40, description: 'Only the lists by this username.' },
          limit: {
            type: 'integer', minimum: 1, maximum: MAX_LIMIT, default: DEFAULT_LIMIT,
            description: 'How many lists at most.'
          }
        },
        additionalProperties: false
      },
      outputSchema: {
        type: 'object',
        properties: {
          lists: {
            type: 'array',
            description: 'The lists found, or the one list asked for by id with its places in `items`.',
            items: {
              type: 'object',
              properties: {
                ...LIST_FIELDS,
                first_places: {
                  type: 'array', items: { type: 'string' },
                  description: 'The first three places on it, on a search.'
                },
                items: {
                  type: 'array', items: { type: 'object', properties: LIST_PLACE_FIELDS },
                  description: 'Every place on it, when it was read by id.'
                }
              }
            }
          },
          note: { type: 'string', description: 'Present when nothing fits: one sentence saying so.' }
        },
        required: ['lists']
      },
      annotations: ANNOTATIONS
    },
    /* ChatGPT's two, in the shape it fixed — AND CHATGPT'S TWO. No
       outputSchema: the shape is the text block's JSON, which is what
       ChatGPT reads. */
    {
      name: 'search',
      title: 'Search Tallinn Tastebuds',
      description:
        'Search the places on Tallinn Tastebuds, one person\'s map of places to eat and drink in ' +
        'Tallinn they have eaten at and approved, by a few words: a name, a street, a kind of ' +
        'place, a dish. Answers with ids, names and links; pass an id to `fetch` for the ' +
        'write-up. When you can call `places` instead, do: it takes a kind of place, a price and ' +
        'a point to measure from, and answers with the write-ups in one call.',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string', maxLength: MAX_QUERY, description: 'A few words to look for.' }
        },
        required: ['query'],
        additionalProperties: false
      },
      annotations: ANNOTATIONS
    },
    {
      name: 'fetch',
      title: 'Read a place on Tallinn Tastebuds',
      description:
        'Read one place on Tallinn Tastebuds whole, by the id `search` gave: Tallinn Tastebuds\' ' +
        'own write-up, the dishes to order, the price on the map\'s own scale, the address and ' +
        'the link. Being on the map is the verdict; there are no scores. Opening hours are not ' +
        'in it.',
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'The id `search` gave.' }
        },
        required: ['id'],
        additionalProperties: false
      },
      annotations: ANNOTATIONS
    }
  ];
}

/* The names a call may ask for, for the error that names a wrong one. The
   four from before the two are still answered — WHY TWO TOOLS — and are not
   named here, since nothing should be told to call them. */
const TOOL_NAMES = ['places', 'lists', 'search', 'fetch'];

/* ------------------------------------------------------------- a place
 * The row as a tool answers with it. The write-up in one language, the
 * dishes, and the three addresses the file does not carry: the place on the
 * map, its first photograph (a copy of photoOf() in functions/index.js, since
 * a route is not a module) and, on a place read by its id, the Google Maps
 * search.
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
    reel: place.reel || null,
    has_reel: !!place.reel
  };
}

function detail(place, lang) {
  return {
    ...entry(place, lang),
    photos: (place.photos || []).map((photo) => photoUrl(place, photo)),
    phone: place.phone || null,
    website: place.website || null,
    visited: place.visited || null,
    added: place.added || null,
    maps_url: mapsSearch(place.name, place.address)
  };
}

/* A Google Maps search for a name and an address, which is a link anybody
   could type and carries nothing out of the export: a place read by its id
   has one, and so does a place on a list that is not on the map. */
function mapsSearch(name, address) {
  return 'https://www.google.com/maps/search/?api=1&query=' +
    encodeURIComponent(address ? name + ', ' + address : name + ', Tallinn');
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

/* ------------------------------------------------------------- the lists
 * Every public list of MIN_ITEMS places or more, with its places' names, in
 * one read: the lists joined to their rows and grouped here, so a word can
 * land on a place deep in a list and not only on the three the lists page
 * prints. Every row of every public list, a couple of hundred today; it
 * grows with what people write, and READ_CAP is where it stops rather than
 * where it should ever arrive — the day it does, this wants the LIKE search
 * mostKept() in functions/api/_mostkept.js already runs, with its paging.
 *
 * The order is how well the words matched and then the title, alphabetical,
 * as a search of the places orders a tie: not how often a list is opened, which is
 * the lists page's order and a ranking this server has no reason to repeat.
 */
const READ_CAP = 2000;

const LIST_WEIGHTS = [['title', 4], ['intro', 3], ['by', 2], ['names', 2]];

const listUrl = (id) => SITE + '/list/' + encodeURIComponent(id);

async function publicLists(env) {
  const { results } = await env.DB
    .prepare(
      'SELECT l.id AS id, l.title AS title, l.intro AS intro, u.username AS by, i.name AS name ' +
      'FROM lists l LEFT JOIN users u ON u.id = l.owner ' +
      'JOIN list_items i ON i.list_id = l.id ' +
      'WHERE l.public = 1 ORDER BY l.id, i.pos LIMIT ?'
    )
    .bind(READ_CAP)
    .all();
  const lists = new Map();
  for (const row of results) {
    if (!lists.has(row.id)) {
      lists.set(row.id, { id: row.id, title: row.title, intro: row.intro || '', by: row.by || null, names: [] });
    }
    lists.get(row.id).names.push(row.name);
  }
  return [...lists.values()].filter((l) => l.names.length >= MIN_ITEMS);
}

async function searchLists(env, raw) {
  const query = optionalString(raw, 'query', MAX_QUERY);
  const by = foldWords(optionalString(raw, 'by', 40)).trim();
  const limit = optionalNumber(raw, 'limit');
  const words = wordsOf(query);

  const found = [];
  for (const list of await publicLists(env)) {
    if (by && foldWords(list.by || '') !== by) continue;
    const hay = {
      title: foldWords(list.title),
      intro: foldWords(list.intro),
      by: foldWords(list.by || ''),
      names: foldWords(list.names.join(' '))
    };
    let hits = 0;
    for (const word of words) {
      for (const [field, weight] of LIST_WEIGHTS) {
        if (hay[field].includes(word)) { hits += weight; break; }
      }
    }
    if (words.length && !hits) continue;
    found.push({ list, hits, title: hay.title });
  }
  found.sort((a, b) => b.hits - a.hits || (a.title < b.title ? -1 : a.title > b.title ? 1 : 0));

  const out = {
    lists: found
      .slice(0, limit === null ? DEFAULT_LIMIT : Math.min(MAX_LIMIT, Math.max(1, Math.floor(limit))))
      .map(({ list }) => ({
        id: list.id,
        title: list.title,
        intro: list.intro,
        by: list.by,
        places: list.names.length,
        url: listUrl(list.id),
        first_places: list.names.slice(0, 3)
      }))
  };
  if (!out.lists.length) out.note = 'No public list on Tallinn Tastebuds fits that.';
  return out;
}

/* One list, through readList() in functions/api/_lists.js — the same reader
   the list page seeds from, so the two cannot disagree about what is on it —
   signed out, so a private list is the null it is to any stranger. Each row
   in the author's order, said in the author's words, with its name, address
   and point, and the map's id and link when the place is also on the map.
   The list itself, or a tool error saying there is none. */
async function getList(context, raw, all) {
  const id = optionalString(raw, 'id', 60);
  if (!id) throw bad('id is required');
  const list = LIST_ID.test(id) ? await readList(context, id, null) : null;
  if (!list) return toolError('There is no public list with the id "' + id + '" on Tallinn Tastebuds.');

  const closed = new Set(all.filter((p) => p.closed).map((p) => p.id));
  /* A place on the map brings its video onto the list with it: the list
     row does not carry one, the roll does. */
  const reels = new Map(all.filter((p) => p.reel).map((p) => [p.id, p.reel]));
  return {
    id: list.id,
    title: list.title,
    intro: list.intro || '',
    by: list.by,
    places: list.items.length,
    url: listUrl(list.id),
    items: list.items.map((row, i) => {
      /* A Google row for a place on the map is `map` too, and carries the
         map's id in `mapId`; a row of mine has only `map`, and its own id is
         the map's. */
      const mapId = row.mapId || (row.map ? row.place : null);
      const out = {
        position: i + 1,
        name: row.name,
        note: row.say || null,
        must_order: row.mustOrder || null,
        address: row.address || null,
        lat: row.lat,
        lng: row.lng,
        on_map: !!mapId,
        place_id: mapId || null,
        reel: mapId && reels.get(mapId) || null,
        url: mapId ? SITE + '/?spot=' + encodeURIComponent(mapId) : mapsSearch(row.name, row.address)
      };
      if (mapId && closed.has(mapId)) out.closed = true;
      return out;
    })
  };
}

/* ------------------------------------------------------------- the calls
 * The protocol's tool result: the object twice, or a sentence with isError
 * on it. search() and the lists above; reading one place is here.
 */
function toolResult(object) {
  return { content: [{ type: 'text', text: JSON.stringify(object) }], structuredContent: object };
}

function toolError(sentence) {
  return { content: [{ type: 'text', text: sentence }], isError: true };
}

/* Whether a call to `places` or `lists` names one to read rather than
   asking for a search. */
const named = (args) => args.id !== undefined && args.id !== null && args.id !== '';

/* One place or one list read by its id, as a tool result: inside the
   `places` or `lists` array the two tools answer with, or bare for the old
   get_place and get_list (WHY TWO TOOLS), which answered with the object
   itself. A tool error passes through as it is. */
function readOne(found, key) {
  if (found.isError) return found;
  return toolResult(key ? { [key]: [found] } : found);
}

/* The lists, which are the only thing here that reads the database. A
   database that is missing, the wrong one, or failing costs the lists and
   nothing else: a tool result saying so, while the places answer as ever.
   Bad arguments still go up as the protocol's invalid-params error. */
async function listCall(context, name, args, all) {
  const { env } = context;
  const down = toolError('The lists on Tallinn Tastebuds cannot be read right now; the places can.');
  if (!env.DB || await wrongDatabase(env)) return down;
  try {
    if (name === 'search_lists' || name === 'lists' && !named(args)) return toolResult(await searchLists(env, args));
    return readOne(await getList(context, args, all), name === 'lists' ? 'lists' : null);
  } catch (e) {
    if (e.invalid) throw e;
    return down;
  }
}

/* One place whole, or a tool error saying it has closed or was never on
   the map. */
function getPlace(raw, places, all, langs) {
  const id = optionalString(raw, 'id', 80);
  if (!id) throw bad('id is required');
  const lang = language(raw, langs);
  const place = places.find((p) => p.id === id);
  if (place) return detail(place, lang);
  const closed = all.find((p) => p.id === id);
  return toolError(closed
    ? closed.name + ' has closed and is no longer on the map.'
    : 'There is no place with the id "' + id + '" on the map.');
}

/* ChatGPT's two — AND CHATGPT'S TWO in the header. `search` is the search
   above with nothing but the words, in English, at the most it will answer
   with; `fetch` is one place as a page of text, the way a research model
   reads and quotes, with the row's facts beside it in `metadata`. */
function chatgptSearch(raw, places, types) {
  const found = search(places, types, {
    query: optionalString(raw, 'query', MAX_QUERY),
    at: null,
    language: DEFAULT_LANG,
    limit: MAX_LIMIT
  });
  return toolResult({ results: found.places.map((p) => ({ id: p.id, title: p.name, url: p.url })) });
}

function chatgptFetch(raw, places, all, types) {
  const place = getPlace(raw, places, all, [DEFAULT_LANG]);
  if (place.isError) return place;
  const kinds = place.types.map((id) => (types.find((t) => t.id === id) || {})[DEFAULT_LANG] || id);
  const text = [
    place.name + ', ' + place.address + '.',
    kinds.length ? 'Kind of place: ' + kinds.join(', ') + '.' : '',
    place.blurb ? 'Tallinn Tastebuds\' write-up: ' + place.blurb : '',
    place.must_order.length ? 'What to order: ' + place.must_order.join('; ') + '.' : '',
    place.price ? 'Price: ' + place.price + ' on the map\'s own scale of 1 (cheap) to 4 (a tasting menu).' : '',
    'Being on the Tallinn Tastebuds map is the verdict: there are no scores, stars or rankings.',
    'On the map: ' + place.url,
    'Directions and opening hours: ' + place.maps_url
  ].filter(Boolean).join('\n\n');
  const { id, name, url, blurb, ...metadata } = place;
  return toolResult({ id, title: name, text, url, metadata });
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
    if (name === 'places' && named(args)) return reply(id, readOne(getPlace(args, places, all, langs), 'places'));
    if (name === 'places' || name === 'search_places') {
      return reply(id, toolResult(search(places, types, searchArgs(args, types, langs))));
    }
    if (name === 'get_place') return reply(id, readOne(getPlace(args, places, all, langs), null));
    if (name === 'search') return reply(id, chatgptSearch(args, places, types));
    if (name === 'fetch') return reply(id, chatgptFetch(args, places, all, types));
    if (name === 'lists' || name === 'search_lists' || name === 'get_list') {
      return reply(id, await listCall(context, name, args, all));
    }
  } catch (e) {
    if (e.invalid) return fail(id, INVALID_PARAMS, e.message);
    throw e;
  }
  return fail(id, INVALID_PARAMS, 'Unknown tool: ' + name, 200, { tools: TOOL_NAMES });
}

/* What a browser needs to be let read an answer, on every answer and on the
   preflight before one — the CORS note under WHAT IS NOT HERE. The request
   headers are the ones the transport sends; nothing is credentialed. */
const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'POST, OPTIONS',
  'access-control-allow-headers': 'content-type, accept, authorization, mcp-protocol-version, mcp-session-id, last-event-id',
  'access-control-max-age': '86400'
};

export async function onRequest(context) {
  const response = context.request.method === 'OPTIONS'
    ? new Response(null, { status: 204 })
    : await handle(context);
  for (const [key, value] of Object.entries(CORS)) response.headers.set(key, value);
  return response;
}

async function handle(context) {
  const request = context.request;

  if (request.method !== 'POST') {
    return new Response(null, {
      status: 405,
      headers: { allow: 'POST, OPTIONS', 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
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
