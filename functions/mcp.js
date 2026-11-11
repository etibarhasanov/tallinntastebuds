/**
 * Tallinn Tastebuds — the map, read by an assistant.
 *
 * POST /mcp   one JSON-RPC 2.0 message    ->  one JSON-RPC 2.0 answer
 *
 * The Model Context Protocol is how Claude, ChatGPT and the rest are handed
 * a tool: a server says what it can do, and a model calls it in the middle
 * of a conversation and reads the answer. This is that server for the map,
 * and it hands over two tools: `places`, which searches my places or reads
 * one, over the roll in data/restaurants.json with Google's opening hours
 * read beside it, and `lists`, which searches
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
 * A place on a list I have not approved is one out of the export or one
 * somebody added by hand, and it answers with its name, its address and its
 * point. One out of the export is on the map all the same, out of the find
 * bar's roll, so its link is its ?spot= on this site like any other; only
 * the hand-typed one, which the map cannot open, links to a Google search. Those are facts about the place, the same ones the list page draws,
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
 * THE PROTOCOL
 *
 * The transport, the handshake and the errors are ./_mcp.js, which the
 * flashcards' door at ./flashcard/mcp.js speaks through as well: stateless,
 * JSON only, and the three versions it answers to, each argued in that
 * file's header. This file is what the map hands over and nothing about how.
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
 * (must_order), the link to its Instagram video where it has one in every
 * row and not only on a place read whole — the video is the one thing a
 * write-up cannot do, so an assistant answering "where should I eat" should
 * be able to hand it over without a second call, and the instructions tell
 * it to, as "Watch the video", every time — and what the file does not hold:
 * the link to the place on the map, the absolute address of its first
 * photograph, and out of the Google row filed against it (GOOGLE'S HALF
 * below) its week of opening hours with the day it was read, its
 * temporarily-closed and the primary type its category names, never its key
 * or its rating — the key only rides inside maps_url, to open the listing; and the reel's one-line summary where a person wrote one. A place read by its id adds
 * a Google Maps link that opens that listing by its key, or a search by my
 * own name and address where Google does not list it. An id that is not on the
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
 * must not be able to move it.
 *
 * functions/_middleware.js lets this address through untouched — it is on
 * the live hostname, under neither owner prefix, and the security headers go
 * on the answer the way they go on every Function's. On the flashcards'
 * hostname /mcp is not this door: the middleware answers it with
 * ./flashcard/mcp.js, which is what somebody handing an assistant that
 * hostname means.
 */

import { mapPlaces, dataFile, languageIndex, nearTallinn, foldWords, km, wrongDatabase, venueHours } from './api/_lib.js';
import { door, bad, optionalString, optionalNumber, named, wordsOf, toolResult, toolError, MAX_QUERY, ANNOTATIONS } from './_mcp.js';
import { readList, LIST_ID } from './api/_lists.js';
import { MIN_ITEMS } from './api/_mostkept.js';
import { SITE } from './_shell.js';

/* How the server introduces itself in `initialize`. `name` is the id a
   client keys it on and stays as it was; the title, the line under it, the
   site and the icons are 2025-11-25's, and what Claude and ChatGPT draw in
   their list of connectors in place of a bare id and a grey square. An
   older client ignores them. The icons are the site's own, the files the
   pages' <link rel="icon"> name. */
const SERVER = {
  name: 'tallinntastebuds',
  title: 'Tallinn Tastebuds',
  version: '1.3.0',
  description: 'A local\'s personal food map of Tallinn: places they\'ve eaten at and approved, ' +
    'with what to order, walking-distance search, and video links.',
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

/* What the assistant is told about the map in `initialize`, before it has
   called anything. Short, because an assistant reads it once beside every
   other server it has, and firm about the one thing the site promises. */
const INSTRUCTIONS =
  'Tallinn Tastebuds is one person\'s map of places in Tallinn they have ' +
  'eaten at and approved. Being on the map is the verdict: there are no ' +
  'scores, stars or rankings, and the order places come back in is never ' +
  'one. So never describe a place as rated, ranked or recommended above ' +
  'another by Tallinn Tastebuds, and never say "best" on its behalf. ' +
  'Attribute the write-ups to Tallinn Tastebuds. Every place you ' +
  'mention links to its url, the place\'s own page on ' +
  'tallinntastebuds.ee, put on the place\'s name so the person can open ' +
  'it there: that is the main link, and maps_url is only for directions. ' +
  'A search that finds nothing means ' +
  'nothing on the map fits; say so rather than guessing. Opening hours, ' +
  'where a place has them, are Google\'s as of opening_hours.checked_at: ' +
  'give them as Google\'s and say they are worth confirming. When ' +
  'opening_hours is null, say the hours should be checked elsewhere. ' +
  'When a place has a reel, always give its link in the answer, ' +
  'labelled \'Watch the video\', alongside the place\'s url. You can\'t ' +
  'watch the video, so don\'t describe what\'s in it unless reel_summary ' +
  'says so. ' +
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
  'Google\'s name: say so. A place on a list with approved false is still ' +
  'on the map and its url opens it there, but it has no write-up from ' +
  'Tallinn Tastebuds, so never call it approved by Tallinn Tastebuds.';

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
  url: {
    type: 'string',
    description: 'The place\'s own page on tallinntastebuds.ee. Always give it, as the link on the place\'s name, ' +
      'ahead of any Google Maps or Instagram link.'
  },
  photo: { type: ['string', 'null'], description: 'The first photograph of the place, or null when there is none.' },
  reel: {
    type: ['string', 'null'],
    description: 'A short video of the place on Instagram, or null. When there is one, always give it as "Watch the video".'
  },
  has_reel: { type: 'boolean', description: 'Whether there is a video of the place: reel is not null.' },
  reel_summary: {
    type: ['string', 'null'],
    description: 'One plain sentence, written by a person, about what the video shows, or null. ' +
      'Describe the video only from this.'
  },
  phone: { type: ['string', 'null'], description: 'The number to ring, or null. Google\'s where the map has none.' },
  website: { type: ['string', 'null'], description: 'The place\'s own website, or null. Google\'s where the map has none.' },
  last_visited: { type: ['string', 'null'], description: 'When Tallinn Tastebuds last ate there, as a month, or null.' },
  primary_type: {
    type: ['string', 'null'],
    description: 'The one main kind of place, as one of the ids in types — "bakery" for a bakery, ' +
      '"restaurant" for a restaurant that also bakes — or null when it is not known.'
  },
  opening_hours: {
    type: ['object', 'null'],
    properties: {
      weekday_text: {
        type: 'array', items: { type: 'string' },
        description: 'Seven lines, Monday first, Tallinn time: "Monday: 08:00-18:00", "Sunday: Closed".'
      },
      source: { type: 'string', description: 'Where the hours came from.' },
      checked_at: { type: ['string', 'null'], description: 'The day they were last read from there, YYYY-MM-DD.' }
    },
    description: 'Google\'s opening hours, or null when there are none to trust: then say they should be checked elsewhere.'
  },
  temporarily_closed: {
    type: 'boolean',
    description: 'Google lists the place as temporarily closed. Say so before suggesting it.'
  }
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
  visited: { type: ['string', 'null'], description: 'When Tallinn Tastebuds ate there, as a month, or null.' },
  added: { type: ['string', 'null'], description: 'When the place joined the map, as a date.' },
  maps_url: {
    type: 'string',
    description: 'The place on Google Maps — its own listing where Google lists it, else a search by ' +
      'name and address — for directions.'
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
  approved: {
    type: 'boolean',
    description: 'Whether Tallinn Tastebuds has eaten there and approved it, with a write-up of its own. ' +
      'When it has, place_id read through the places tool gives the place whole. When it has not, the ' +
      'place is still on the map, out of Google\'s listings, with no write-up from Tallinn Tastebuds.'
  },
  place_id: { type: ['string', 'null'], description: 'The map\'s id for it when approved, else null.' },
  reel: {
    type: ['string', 'null'],
    description: 'A short video of the place on Instagram when approved and there is one, else null. Give it as a link to watch.'
  },
  closed: { type: 'boolean', description: 'Present and true when the map has it as closed.' },
  url: {
    type: 'string',
    description: 'The place on the Tallinn Tastebuds map — approved or out of Google\'s listings, both open ' +
      'there. Only a place the list\'s author typed in by hand, which the map cannot open, has a ' +
      'Google Maps search by name and address here instead.'
  }
};

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
        'otherwise, never quality — with a `type`, the places whose `primary_type` is that kind come ' +
        'first, so a bakery search starts with the bakeries rather than a restaurant that bakes. Every ' +
        'place carries `reel` (an Instagram video, or null — give it as "Watch the video"), ' +
        '`reel_summary`, `photo`, `phone`, `website`, `last_visited` and `primary_type`, and Google\'s ' +
        '`opening_hours` with the day they were checked, or null when there are none to trust. When the conversation turns to one place — "tell me more ' +
        'about Badam", "what should I order there" — pass its `id` instead, and the one place ' +
        'comes back with every photograph, when it was visited, and its Google Maps listing for directions; the filters are ignored then.',
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
        'wrote about each, its address and point, its link on the map, and whether Tallinn ' +
        'Tastebuds has approved it. The order is the author\'s, not the site\'s.',
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
        'write-up, the video link, the main kind of place and Google\'s opening hours where there ' +
        'are any to trust. When you can call `places` instead, do: it takes a kind of place, a price ' +
        'and a point to measure from, and answers with all of that in one call.',
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
        'the link, the video as "Watch the video" where there is one, and Google\'s opening hours ' +
        'with the day they were checked where there are any to trust. Being on the map is the ' +
        'verdict; there are no scores.',
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

function entry(place, lang, google) {
  const photos = place.photos || [];
  const g = google.get(place.id);
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
    /* Mine first, Google's only where mine is empty — the panel's rule, so
       nothing a few lines above on the map is contradicted here. */
    phone: place.phone || g && g.phone || null,
    website: place.website || g && g.website || null,
    reel: place.reel || null,
    /* Kept beside `reel`, which says the same thing, for the clients that
       read it before `reel` was in every row. */
    has_reel: !!place.reel,
    /* Only ever a sentence a person wrote into the place's row: an assistant
       cannot watch the video, and neither can this server. */
    reel_summary: place.reelSummary || null,
    last_visited: place.visited || null,
    primary_type: g ? primaryType(place, g.category) : null,
    opening_hours: g ? g.hours : null,
    temporarily_closed: !!(g && g.shut)
  };
}

function detail(place, lang, google) {
  const g = google.get(place.id);
  return {
    ...entry(place, lang, google),
    photos: (place.photos || []).map((photo) => photoUrl(place, photo)),
    visited: place.visited || null,
    added: place.added || null,
    maps_url: mapsSearch(place.name, place.address, g && g.key)
  };
}

/* A Google Maps search for a name and an address, which is a link anybody
   could type and carries nothing out of the export: a place read by its id
   has one, and so does a place on a list typed in by hand. With
   Google's key beside it, the search opens that one listing rather than
   Google's guess at the words — the address Google documents for it, and
   the one the map's own panel sends. */
function mapsSearch(name, address, key) {
  return 'https://www.google.com/maps/search/?api=1&query=' +
    encodeURIComponent(address ? name + ', ' + address : name + ', Tallinn') +
    (key ? '&query_place_id=' + encodeURIComponent(key) : '');
}

/* ------------------------------------------------------- Google's half
 * The Google row filed against each of my places through `map_id` — the
 * join the map's panel makes through /api/venues?map= and the chat makes in
 * linkedRows() in api/ask.js — read for what an assistant asking "is it open"
 * or "is that a bakery" needs and my file does not hold: the week, when
 * Google was last asked for it, Google's temporarily-closed, what Google
 * files the place as, the phone and website where mine are empty, and the
 * key, which only rides inside maps_url to open the listing. Never the rating, the review count or the
 * rank: the map has no scores and this door does not lend it Google's.
 *
 * A link is only trusted when it is plainly the same door: the names share a
 * word that is not "restaurant" or "bakery" or "Tallinn", and the two points
 * are within SAME_DOOR metres. `map_id` is set by a matcher and can be set
 * by hand, and an assistant handed the wrong listing's hours sends somebody
 * to a shut door with the map's name on the answer. A row that fails is
 * answered as if Google did not list the place — every Google field null —
 * and logged, so the owner's review list is one `wrangler pages deployment
 * tail` away. On the day this was written all sixty-three links passed.
 *
 * One statement, sixty-odd rows, kept five minutes per isolate like the rest
 * of what this route reads, since the join moves once a month and the hours
 * when somebody opens a place on the map. A database that is missing, wrong
 * or down is an empty map: every place answers with its Google fields null,
 * and the places tool answers as it did before there were any.
 */
const GOOGLE_TTL = 5 * 60 * 1000;
const SAME_DOOR = 150;
const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const HOURS_SOURCE = 'Google Maps, through the Google Places API';
let google = null;
let googleAt = 0;

/* The words of a name that say which place it is rather than what kind. */
const GENERIC = new Set([
  'restoran', 'restaurant', 'resto', 'bakery', 'bakehouse', 'boulangerie', 'pagar', 'pagariari',
  'cafe', 'kohvik', 'coffee', 'roastery', 'roasters', 'tea', 'house', 'pub', 'bar', 'baar',
  'brewery', 'taproom', 'kitchen', 'tallinn', 'old', 'town', 'the', 'and', 'ja', 'la'
]);
const squash = (name) => foldWords(name).replace(/[^a-z0-9]/g, '');
const ownWords = (name) => foldWords(name).split(/[^a-z0-9]+/).filter((w) => w.length > 1 && !GENERIC.has(w));

function sameDoor(place, row) {
  if (typeof row.latitude !== 'number' || typeof row.longitude !== 'number') return false;
  if (km(place, { lat: row.latitude, lng: row.longitude }) * 1000 > SAME_DOOR) return false;
  const mine = ownWords(place.name);
  const theirs = ownWords(row.name);
  /* "La Boulangerie" is every word generic: the whole name has to agree. */
  if (!mine.length || !theirs.length) return squash(place.name) === squash(row.name);
  return mine.some((w) => squash(row.name).includes(w)) || theirs.some((w) => squash(place.name).includes(w));
}

async function googleRows(env, places) {
  if (google && Date.now() - googleAt < GOOGLE_TTL) return google;
  if (!env.DB || await wrongDatabase(env)) return new Map();
  let results;
  try {
    ({ results } = await env.DB
      .prepare(
        'SELECT map_id, place_id, name, category, status, opening_hours, phone, website, latitude, longitude, ' +
        'refreshed_at, synced_at FROM google_venues ' +
        'WHERE map_id IS NOT NULL AND hidden = 0 AND missing_since IS NULL'
      )
      .all());
  } catch (e) {
    return new Map();
  }
  const byId = new Map(places.map((p) => [p.id, p]));
  google = new Map();
  for (const row of results || []) {
    /* The first row wins where two carry one map_id, which nothing stops —
       the same LIMIT 1 /api/venues?map= takes. */
    const place = byId.get(row.map_id);
    if (!place || google.has(row.map_id)) continue;
    if (!sameDoor(place, row)) {
      console.log('mcp: google_venues ' + row.place_id + ' (' + row.name + ') does not look like ' +
        place.id + ' (' + place.name + '); answered without Google — review its map_id');
      continue;
    }
    const week = venueHours(row.opening_hours);
    const asked = row.refreshed_at || row.synced_at;
    google.set(row.map_id, {
      key: row.place_id,
      category: row.category || '',
      phone: row.phone || '',
      website: row.website || '',
      shut: row.status === 'Temporarily closed',
      hours: week.length ? {
        weekday_text: DAY_NAMES.map((day, i) => day + ': ' + (week[i] || 'Closed')),
        source: HOURS_SOURCE,
        checked_at: asked ? new Date(asked).toISOString().slice(0, 10) : null
      } : null
    });
  }
  googleAt = Date.now();
  return google;
}

/* The one main kind of place, as one of the map's own type ids — what a
 * search by `type` puts first. My own `types` say everything a place is, in
 * no order that means anything (the admin page writes them out in the
 * taxonomy's), so KoHo, a restaurant that bakes, and a chocolate shop said
 * "bakery" exactly as loudly as Pulla. Google gives each place one category,
 * and the primary type is the one of the place's own types that category
 * names: Pulla's "Bakery" makes it a bakery, Cafe Tempo's "Restaurant" a
 * restaurant, and Karu Talu's "Chocolate Shop" none of its three — null
 * rather than a guess, as for every place Google does not list. A mood —
 * casual, date, laptop — is never a primary type.
 */
const PRIMARY = {
  bakery: /bakery|boulangerie|patisserie|pastry/i,
  coffee: /coffee|cafe|café/i,
  tea: /\btea\b/i,
  pub: /\bpub\b|\bbar\b|brew/i,
  restaurant: /restaurant|izakaya/i,
  vegan: /vegan|vegetarian/i
};

function primaryType(place, category) {
  return (place.types || []).find((id) => PRIMARY[id] && PRIMARY[id].test(category)) || null;
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

function score(hay, words) {
  let total = 0;
  for (const word of words) {
    for (const [field, weight] of WEIGHTS) {
      if (hay[field].includes(word)) { total += weight; break; }
    }
  }
  return total;
}

function search(places, types, args, google) {
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
    const g = google.get(place.id);
    const first = !!args.type && !!g && primaryType(place, g.category) === args.type;
    found.push({ place, hits, far, first });
  }
  found.sort((a, b) => {
    if (a.first !== b.first) return a.first ? -1 : 1;
    if (at && a.far !== b.far) return a.far - b.far;
    if (b.hits !== a.hits) return b.hits - a.hits;
    const x = foldWords(a.place.name);
    const y = foldWords(b.place.name);
    return x < y ? -1 : x > y ? 1 : 0;
  });
  found = found.slice(0, args.limit);
  const out = {
    places: found.map((f) => {
      const row = entry(f.place, lang, google);
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
 * The `places` search's arguments read off the call and held to the schema
 * that was sent, through the readers in ./_mcp.js: one message per thing
 * wrong, thrown, and turned there into the protocol's invalid-params error.
 */
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
   and point, its link on the map, and the map's id when the place is approved.
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
         the map's. Every other Google row is on the map as well, out of the
         find bar's roll, and ?spot= with its key opens it there — a Google
         key always carries capitals, the rule paintShare() in assets/app.js
         reads. Only a place typed in by hand, lowercase and in no roll, has
         nowhere on the map to open, and gets a Google Maps search. */
      const mapId = row.mapId || (row.map ? row.place : null);
      const spot = mapId || (/[A-Z]/.test(row.place) ? row.place : null);
      const out = {
        position: i + 1,
        name: row.name,
        note: row.say || null,
        must_order: row.mustOrder || null,
        address: row.address || null,
        lat: row.lat,
        lng: row.lng,
        approved: !!mapId,
        place_id: mapId || null,
        reel: mapId && reels.get(mapId) || null,
        url: spot ? SITE + '/?spot=' + encodeURIComponent(spot) : mapsSearch(row.name, row.address)
      };
      if (mapId && closed.has(mapId)) out.closed = true;
      return out;
    })
  };
}

/* ------------------------------------------------------------- the calls
 * search() and the lists are above; reading one place is here.
 */

/* One place or one list read by its id, as a tool result: inside the
   `places` or `lists` array the two tools answer with, or bare for the old
   get_place and get_list (WHY TWO TOOLS), which answered with the object
   itself. A tool error passes through as it is. */
function readOne(found, key) {
  if (found.isError) return found;
  return toolResult(key ? { [key]: [found] } : found);
}

/* The lists, which read the database for everything they answer. A
   database that is missing, the wrong one, or failing costs the lists and
   nothing else: a tool result saying so, while the places answer as ever,
   without Google's hours — GOOGLE'S HALF.
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
function getPlace(raw, places, all, langs, google) {
  const id = optionalString(raw, 'id', 80);
  if (!id) throw bad('id is required');
  const lang = language(raw, langs);
  const place = places.find((p) => p.id === id);
  if (place) return detail(place, lang, google);
  const closed = all.find((p) => p.id === id);
  return toolError(closed
    ? closed.name + ' has closed and is no longer on the map.'
    : 'There is no place with the id "' + id + '" on the map.');
}

/* ChatGPT's two — AND CHATGPT'S TWO in the header. `search` is the search
   above with nothing but the words, in English, at the most it will answer
   with; `fetch` is one place as a page of text, the way a research model
   reads and quotes, with the row's facts beside it in `metadata`. */
function chatgptSearch(raw, places, types, google) {
  const found = search(places, types, {
    query: optionalString(raw, 'query', MAX_QUERY),
    at: null,
    language: DEFAULT_LANG,
    limit: MAX_LIMIT
  }, google);
  return toolResult({ results: found.places.map((p) => ({ id: p.id, title: p.name, url: p.url })) });
}

function chatgptFetch(raw, places, all, types, google) {
  const place = getPlace(raw, places, all, [DEFAULT_LANG], google);
  if (place.isError) return place;
  const kinds = place.types.map((id) => (types.find((t) => t.id === id) || {})[DEFAULT_LANG] || id);
  const text = [
    place.name + ', ' + place.address + '.',
    kinds.length ? 'Kind of place: ' + kinds.join(', ') + '.' : '',
    place.blurb ? 'Tallinn Tastebuds\' write-up: ' + place.blurb : '',
    place.must_order.length ? 'What to order: ' + place.must_order.join('; ') + '.' : '',
    place.price ? 'Price: ' + place.price + ' on the map\'s own scale of 1 (cheap) to 4 (a tasting menu).' : '',
    place.temporarily_closed ? 'Google lists it as temporarily closed.' : '',
    place.opening_hours
      ? 'Opening hours, Tallinn time, from ' + place.opening_hours.source +
        (place.opening_hours.checked_at ? ' as of ' + place.opening_hours.checked_at : '') + ': ' +
        place.opening_hours.weekday_text.join('; ') + '.'
      : 'Opening hours are not in this data; check them elsewhere.',
    'Being on the Tallinn Tastebuds map is the verdict: there are no scores, stars or rankings.',
    place.phone ? 'Phone: ' + place.phone + '.' : '',
    place.website ? 'Website: ' + place.website : '',
    'On the map: ' + place.url,
    place.reel ? 'Watch the video: ' + place.reel : '',
    place.reel_summary ? 'The video: ' + place.reel_summary : '',
    'Directions on Google Maps: ' + place.maps_url
  ].filter(Boolean).join('\n\n');
  const { id, name, url, blurb, ...metadata } = place;
  return toolResult({ id, title: name, text, url, metadata });
}

/* --------------------------------------------------------------- the door
 * Both tools/list and a call read the deployment: the roll, the kinds of
 * place and the languages, each five minutes per isolate through _lib.js.
 */
async function deployment(context) {
  const [all, taxonomy, index] = await Promise.all([
    mapPlaces(context),
    dataFile(context, '/data/taxonomy.json'),
    languageIndex(context)
  ]);
  return { all, types: taxonomy.types, langs: Object.keys(index) };
}

async function call(context, name, args) {
  const { all, types, langs } = await deployment(context);
  const places = all.filter((p) => !p.closed);
  if (name === 'lists' || name === 'search_lists' || name === 'get_list') return listCall(context, name, args, all);
  if (!/^(places|search_places|get_place|search|fetch)$/.test(name)) return undefined;
  /* The lists read the database on their own; only the place tools want
     Google's half — GOOGLE'S HALF above. */
  const google = await googleRows(context.env, all);
  if (name === 'places' && named(args)) return readOne(getPlace(args, places, all, langs, google), 'places');
  if (name === 'places' || name === 'search_places') {
    return toolResult(search(places, types, searchArgs(args, types, langs), google));
  }
  if (name === 'get_place') return readOne(getPlace(args, places, all, langs, google), null);
  if (name === 'search') return chatgptSearch(args, places, types, google);
  return chatgptFetch(args, places, all, types, google);
}

export const onRequest = door({
  server: SERVER,
  instructions: INSTRUCTIONS,
  tools: async (context) => {
    const { types, langs } = await deployment(context);
    return tools(types, langs);
  },
  call,
  names: TOOL_NAMES,
  what: 'The map'
});
