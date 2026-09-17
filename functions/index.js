/**
 * Tallinn Tastebuds — the map, and what one place's link looks like in a message.
 *
 * WHY IT EXISTS
 *
 * The map is one page and `?spot=<id>` is a deep link into it rather than a
 * document of its own — assets/app.js points the canonical tag at the bare
 * address for exactly that reason. So every link anybody has ever sent about a
 * place is index.html with a query on it, and pasted into a message it arrived
 * as the site: "Tallinn Tastebuds | Where to eat in Tallinn", the tagline and
 * the watercolour mouth, whichever place it pointed at. One card for all of
 * them tells the person it was sent to nothing about why it was sent, which is
 * the whole of what a card is for.
 *
 *   the card now says   "Varkizana Kreeka tavern"
 *   under it            that place's write-up, in the language the link carries
 *   and the picture is  the first of that place's own photographs
 *
 * None of that is possible from a static file. A static page has one head, and
 * the crawler that builds the little card in WhatsApp, Telegram or Slack does
 * not run the script that would change it. So this Function serves the page
 * instead: the map, with the block between the <!--PAGE-HEAD--> markers
 * swapped for that place's own tags. It is still index.html — one page, one
 * script, one stylesheet — handed back with a different head rather than a
 * second copy of the markup that would go stale the first time the other one
 * changed.
 *
 * It is the argument functions/list/[id].js makes for a shared list and
 * functions/split.js for a group, and it borrows esc(), rehead(), canonical()
 * and SITE from functions/_shell.js. head() is not one of them: it spells one
 * title for every caller and hands every caller the mark as its picture, and
 * neither is right here.
 *
 * THE PAGE COMES FROM context.next(), NOT FROM A FILENAME
 *
 * The other four routes name the file they serve — '/lists.html' in shell(),
 * '/split.html' in functions/split.js — because the address each answers at is
 * not its file's. This one's is: "/" *is* index.html, and asking Pages for
 * "/index.html" by name is asking for a path it answers with a 308 back to
 * "/". context.next() has no such question in it: it is, by definition, what
 * this request would have been answered with had this route not existed, so
 * the bytes are right whatever Pages decides to do with a filename, and the
 * headers arrive with them.
 *
 * WITHOUT A ?spot=, NOTHING HAPPENS
 *
 * The bare map is that same context.next() handed back untouched: the same
 * bytes, the same headers _headers writes for "/", the same ETag. That matters
 * more here than on the other four routes, because this is the page most
 * people open and the only one on this site anybody arrives at cold. A link
 * with a spot on it is the exception and pays for itself; a visit to the front
 * page pays one comparison.
 *
 * A swapped page keeps those headers too — the Cache-Control that revalidates
 * for the sake of the ?v= stamps, the nosniff, the referrer policy — because
 * they are copied off that response rather than written out again here, and a
 * second copy of _headers is a second copy to fall behind. The ETag is the one
 * thing dropped: it is a hash of a document with a different head on it.
 *
 * THE LANGUAGE OF THE CARD
 *
 * The card speaks whatever `?lang=` the link carries, and English otherwise.
 *
 * That is the opposite of what describe() in functions/list/[id].js does, and
 * deliberately. There the argument is that a card has no reader to ask: a
 * crawler's Accept-Language is whatever its operator set, and the card is
 * shown to everybody the link is forwarded to rather than to the machine that
 * fetched it. Both halves are still true, and nothing here reads
 * Accept-Language either. What is different is that this link says so itself.
 * Somebody who shares `?lang=et` has chosen Estonian for the person they are
 * sending it to, and honouring that is reading the link rather than guessing
 * at a reader.
 *
 * A language is taken only where that place actually has a write-up in it, so
 * there is no list of the ten to keep in step with data/ui.json — the blurb's
 * own keys are the list, and a language a place has not been translated into
 * falls back to English the way the panel does.
 *
 * THE PICTURE
 *
 * The place's first photograph where it has one, and the mark where it does
 * not, which today is fifty-three of the seventy-six. Absolute, and on the
 * live host even from a preview, for the reason functions/split.js gives about
 * the same file: an unfurler is not a browser and does not resolve a relative
 * URL, and a preview's address outlives nothing.
 *
 * They are photographs off a phone rather than cards drawn at 1200×630, so
 * `og:image:width` and `og:image:height` are not written for one — a size
 * claimed and wrong is worse than a size an unfurler measures for itself, and
 * nothing in this repository knows a photo's dimensions without opening the
 * file. Most are portrait, which Telegram and Slack show whole and WhatsApp
 * crops to a band. The mark keeps its 1200×630, because that one is known.
 *
 * CANONICAL AND og:url DISAGREE, ON PURPOSE
 *
 * `<link rel="canonical">` stays where index.html points it, at the bare
 * address, and sits outside the markers so this route cannot touch it. `og:url`
 * is the spot's own link. The two are answering different questions and the
 * right answers differ:
 *
 *   a crawler asks    which page is this, so I index it once
 *   an unfurler asks  which thing is this, so I cache one card per thing
 *
 * Pooling the search signals at one address is the decision canonicalBase() in
 * assets/app.js explains, and this does not disturb it. But an `og:url` of "/"
 * would tell Facebook that every place on the map is one object, and the
 * first card it built would be the card every one of them got afterwards —
 * which is the bug this route exists to fix, arriving by the back door. The
 * language rides along in `og:url` when the link carried one, for the same
 * reason: one object per place per language, rather than one object whose card
 * is in whichever language happened to be fetched first.
 *
 * WHAT IT DOES NOT DO
 *
 * `?type=` and `?story=` are deep links too and get the site's own card,
 * unchanged. A type is a filter rather than a thing with a name and a
 * photograph, and a story is gone within the day — neither has what makes this
 * worth a swap. A discount running at a place is not mentioned either: that
 * lives in data/deals.json behind a roll and an hour, and a card a chat app
 * caches for a week is the wrong place to put something true for one.
 *
 * WHEN IT CANNOT
 *
 * Every failure ends the same way: the plain map, and assets/app.js selects
 * the place from `?spot=` on boot the way it always has. No such id,
 * restaurants.json unreadable, index.html missing its markers — all of them
 * are the untouched page. This route is an improvement on a link, never a
 * requirement for one.
 */

import { mapPlaces, uiStrings } from './api/_lib.js';
import { SITE, canonical, esc, rehead } from './_shell.js';

/* How much of a write-up goes under the name. The blurbs run to 370 characters
   and an unfurler cuts its own at somewhere between 200 and 300 without asking
   where the words are, so this cuts first, and at a space. */
const MAX_DESCRIPTION = 200;

function clip(text) {
  if (text.length <= MAX_DESCRIPTION) return text;
  const cut = text.slice(0, MAX_DESCRIPTION);
  const space = cut.lastIndexOf(' ');
  /* Half the budget, so a language that does not put spaces between its words
     gets a hard cut at the limit rather than a two-word card. */
  const kept = space > MAX_DESCRIPTION / 2 ? cut.slice(0, space) : cut;
  return kept.replace(/[\s.,;:!?—–-]+$/, '') + '…';
}

/* Which language the card speaks: the one the link asked for where this place
   has been written up in it, and English otherwise. hasOwn rather than a plain
   lookup, because `?lang=` is somebody's query string and `constructor` is a
   key every object in JavaScript answers to. */
function languageOf(blurb, asked) {
  return asked && Object.hasOwn(blurb, asked) && typeof blurb[asked] === 'string'
    ? asked
    : 'en';
}

/* The line under the name: the write-up, and the address for a place that has
   none yet — which is a true thing to say about it rather than filler, and the
   same fact the panel leads with. */
function describe(place, lang, closed) {
  const blurb = (place.blurb && place.blurb[lang]) || '';
  const text = blurb || place.address || '';
  /* A place that has shut keeps its pin and its link — closedNote in
     data/ui.json promises exactly that — so the card says so before the
     write-up sells a kitchen that is not cooking. */
  return clip(closed ? closed + '. ' + text : text);
}

export async function onRequest(context) {
  const { request } = context;
  const params = new URL(request.url).searchParams;
  const id = params.get('spot') || '';

  /* The map itself, and nothing to say about it that its own head does not. */
  if (!id) return context.next();

  let place;
  try {
    place = (await mapPlaces(context)).find((p) => p.id === id);
  } catch (e) {
    /* restaurants.json out of reach. The map fetches it for itself in a
       moment and will say whatever is true then. */
    return context.next();
  }

  /* An id that is not a place is not a missing page: the map draws either way,
     and assets/app.js ignores a `?spot=` it cannot find. So it gets the map. */
  if (!place) return context.next();

  const asked = params.get('lang');
  const lang = languageOf(place.blurb || {}, asked);

  let closed = '';
  if (place.closed) {
    try {
      const strings = await uiStrings(context);
      closed = (strings[lang] || strings.en || {}).closedFlag || '';
    } catch (e) {
      /* Nothing to say it with. The write-up alone is still this place, and
         the map under it says the rest the moment somebody taps. */
    }
  }

  const name = esc(place.name);
  const description = esc(describe(place, lang, closed));
  const photo = place.photos && place.photos[0];

  /* The address this is a card for. `?lang=` only where the link carried one
     and this place speaks it, so a link with no language on it stays one
     object rather than becoming one per crawler. */
  const url = esc(canonical(
    request,
    '/?spot=' + encodeURIComponent(place.id) +
      (asked === lang ? '&lang=' + encodeURIComponent(lang) : '')
  ));

  const tags = [
    /* The only <title> the page has: index.html keeps its own inside these
       markers, so this replaces it rather than queueing behind it. What a
       browser ends up showing is assets/app.js's, written over this out of
       data/ui.json the moment the script boots — the map's tab is the site's
       name in the reader's own language, and a place being open in the panel
       does not change which page you are on. This is for the unfurlers that
       read the tag rather than og:title. */
    '<title>' + name + ' | Tallinn Tastebuds</title>',
    /* A restaurant at a coordinate is a place, which is a type Open Graph
       already has and the two properties under it are what it is for. Nothing
       draws a richer card for it than it would for "website"; it is simply the
       true one, and a true type costs no more than a vague one. */
    '<meta property="og:type" content="place">',
    '<meta property="place:location:latitude" content="' + esc(place.lat) + '">',
    '<meta property="place:location:longitude" content="' + esc(place.lng) + '">',
    '<meta property="og:site_name" content="Tallinn Tastebuds">',
    '<meta property="og:url" content="' + url + '">',
    /* The name on its own. og:site_name beside it already says where the link
       leads, so the suffix the <title> carries would spend the front of the
       card saying it a second time — the argument functions/split.js makes for
       a group's name, and a restaurant's is no less the point of the card. */
    '<meta property="og:title" content="' + name + '">',
    '<meta property="og:description" content="' + description + '">',
    ...(photo ? [
      '<meta property="og:image" content="' + esc(SITE + '/photos/' +
        encodeURIComponent(place.id) + '/' + encodeURIComponent(photo)) + '">',
      /* The name and nothing more. It is the one description of the picture
         that is true of all of them — a photograph of this place — without
         claiming which of the room, the plate or the sign it is, and being a
         proper noun it needs no translating into the card's language. */
      '<meta property="og:image:alt" content="' + name + '">'
    ] : [
      '<meta property="og:image" content="' + SITE + '/assets/logo/og.jpg">',
      '<meta property="og:image:width" content="1200">',
      '<meta property="og:image:height" content="630">'
    ]),
    '<meta name="twitter:card" content="summary_large_image">'
  ].join('\n');

  const res = await context.next();
  const html = rehead(await res.text(), tags);

  /* Not page() from functions/_shell.js: that answers no-store, which is right
     for a list somebody is editing and wrong for the map. The response this
     page would have had is the right one, so it is the one handed back — minus
     its ETag, which is a hash of a document with a different head on it, and
     minus a Content-Length measured before the swap. */
  const headers = new Headers(res.headers);
  headers.delete('etag');
  headers.delete('content-length');
  return new Response(html, { status: res.status, headers });
}
