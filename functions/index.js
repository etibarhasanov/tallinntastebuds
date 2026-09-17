/**
 * Tallinn Tastebuds — /, the map, in the language its address names; every
 * place on it at an address of its own; and what one place's link looks like
 * in a message.
 *
 * The map is one static file with an English head: an English title, an
 * English description, `<html lang="en">`, and a canonical tag pointing every
 * address at the bare one. The other nine languages exist only once
 * assets/app.js has run and rewritten the page in place. That is fine for a
 * person and wrong for a search engine, in two different ways:
 *
 *   A crawler that does not run the script — Bing on many of its visits,
 *   Yandex on most — reads the file as served: English, with no places in it
 *   at all, since the rows are drawn from data/restaurants.json after the
 *   fact.
 *
 *   A crawler that does — Google — sees the page in whatever language the
 *   script picks for a visitor with no history, which is English again, and
 *   is then told by the canonical tag that /?lang=ru is the same document as
 *   /. So it indexes one page, once, in English.
 *
 * Either way, somebody searching in Russian, Estonian or Finnish for where to
 * eat in this city was never going to find a map that has been written in all
 * three since the day it went up.
 *
 * So this route serves the same file with the head written for the language
 * the address names. ?lang=ru is a page — the map, in Russian — with
 *
 *   <html lang="ru">, the Russian title, the Russian description, a
 *   canonical tag naming /?lang=ru itself, an hreflang link to every one of
 *   the ten addresses so a search engine knows they are one page in ten
 *   languages rather than ten copies of one, the card tags in Russian, and
 *   the JSON-LD block — the site and every open place on it, with each
 *   write-up in Russian — that assets/app.js used to build after the map had
 *   drawn, where only a crawler that runs scripts could ever read it.
 *
 * / is English and is also the x-default. The page underneath still follows
 * the visitor: assets/app.js reads ?lang= first, a stored choice second, the
 * browser third, so a person and a crawler arriving at the same address see
 * the same language.
 *
 * A PLACE IS AN ADDRESS, AND A CARD
 *
 * ?spot=badam has always opened the map standing on Badam, and it was a deep
 * link: the canonical tag folded it back into the bare page, so a search for
 * the place by name found the whole map or nothing, and a link to it pasted
 * into WhatsApp, Telegram or Slack unfurled as the site — one card for all
 * seventy-odd places, with the one thing the message was about in the part
 * of the link nobody reads. Now it is a page and a card: the same file, the
 * same map, the same panel opening on the same place, with a head of its
 * own. The place's name for a title, its write-up for a description, a
 * canonical naming /?spot=badam itself, the same hreflang set for the same
 * place in the other nine languages, a JSON-LD block describing that one
 * place rather than seventy, and the page's text led by the place with the
 * other sixty-nine by name, each linked to its own address — which is what
 * makes seventy addresses seventy pages rather than one page under seventy
 * names, and what lets a crawler walk from any of them to all of them.
 *
 * The card is the same head read by an unfurler, and four things about it
 * are decisions. It speaks the language the link carries: somebody who
 * shares ?lang=et has chosen Estonian for the person they are sending it to,
 * which is the opposite of what a shared list does and right for the
 * opposite reason — a list's card has no reader to ask, and this link says.
 * The picture is the place's first photograph where it has one, with no
 * width or height claimed for it, because nothing here knows a photo's
 * dimensions without opening the file and a size claimed wrongly is worse
 * than one an unfurler measures for itself; a place with no photographs gets
 * the mark, whose size is known. The type is `place`, with the coordinates
 * under it, because that is the true one and a true type costs no more than
 * a vague one. And the description for the card is cut at a space before
 * two hundred characters, since an unfurler cuts its own somewhere between
 * two and three hundred without asking where the words are; the description
 * for a search engine is the whole write-up.
 *
 * A closed place keeps its card and is not a page. Its ?spot= link still
 * opens, because links that were shared still work, and the card says so
 * first — closedFlag, in the card's language, before the write-up, so a card
 * cannot sell a kitchen that is not cooking. But marking up a business that
 * no longer serves anyone would be a false statement about the world, so the
 * canonical goes back to the map's own address, the JSON-LD and the text are
 * the map's, and tools/sitemap.mjs leaves it out. ?type=, ?style= and ?list=
 * stay deep links, left off every canonical and given the map's own card: a
 * filter has no name and no photograph.
 *
 * THE PLACES, AS TEXT
 *
 * The head is not the whole of it. A reader that runs no script — Bing on
 * a bad day, and every AI assistant's fetcher on every day: ChatGPT-User,
 * Claude-User, PerplexityBot read a page as text and throw the scripts away,
 * JSON-LD included — got four hundred characters out of this page and not
 * one place name, because the rows are drawn by assets/app.js into an empty
 * #list-body. So this route fills that element too: every open place, in
 * the alphabet, as an ordinary list — the name linked to its own address,
 * its kinds in the page's language, its address, its write-up in the page's
 * language, and the dishes to order, which are the words somebody types
 * when they want khachapuri or a hazy IPA rather than a restaurant. Some
 * forty kilobytes of markup around eleven of prose, and the words that were
 * always the point of the site are finally in the page as served.
 *
 * Nobody sees it. renderList() in assets/app.js empties #list-body before
 * it draws the first row, and the panel it sits in is closed until the
 * script opens it, so a visitor's browser never paints these. They are for
 * the reader that never runs the script — and for the one that does, since
 * a crawler that renders the page finds the same seventy places drawn by the
 * script a moment later, under the same title: renderPanel() writes a
 * place's name into the tab while it is open and the site's own otherwise,
 * which is what this route wrote into the head.
 *
 * THE PAGE COMES FROM context.next(), NOT FROM A FILENAME
 *
 * The other four routes name the file they serve — '/lists.html' and
 * '/split.html' through shell() — because the address each answers at is not
 * its file's. This one's is: "/" *is* index.html, and asking Pages for
 * "/index.html" by name is asking for a path it answers with a 308 back to
 * "/". context.next() has no such question in it: it is, by definition, what
 * this request would have been answered with had this route not existed, so
 * the bytes are right whatever Pages decides to do with a filename, and the
 * headers arrive with them — the Cache-Control that revalidates for the
 * sake of the ?v= stamps, the nosniff, the referrer policy, all written once
 * in _headers and copied off that answer rather than restated here. The ETag
 * is the one thing dropped: it is a hash of a document with a different head
 * and different text on it. What a browser loses is the 304; hashing the
 * whole answer per request to give one back would save it a few kilobytes it
 * is about to spend on the tiles.
 *
 * WHAT IT COSTS
 *
 * Nothing new per request. _routes.json already sends every request for a
 * page through functions/_middleware.js, so a Functions invocation was being
 * spent on / before this file existed; this is the same invocation doing more.
 * The two data files come out of the deployment through the ASSETS binding,
 * a subrequest rather than a fetch across the internet, and are kept for five
 * minutes per isolate by dataFile() in functions/api/_lib.js, the way the
 * places are. What a visitor pays is the JSON-LD and the list on the wire —
 * some eighty-five kilobytes before compression, twenty or so after, on a
 * page that was ten compressed — and the 304 above.
 *
 * WHEN IT CANNOT
 *
 * The page or a data file missing from the deployment is a broken build, and
 * the answer is the static file, English head, no JSON-LD — the map exactly
 * as it was served before this route existed. This is an improvement on the
 * load, never a requirement for it.
 */

import { mapPlaces, dataFile } from './api/_lib.js';
import { SITE, esc, seed, rehead, canonical, fill, EMPTY } from './_shell.js';

/* The language the static file is written in, which is also what an address
   with no ?lang= means, and what a ?lang= nobody speaks falls back to. The
   same constant is DEFAULT_LANG in assets/app.js. */
const DEFAULT_LANG = 'en';

/* What follows a place's name in its title: the same suffix head() in
   _shell.js puts after a list's name and assets/lists.js after a profile's,
   and the one renderPanel() in assets/app.js writes while a place is open. */
const SUFFIX = ' | Tallinn Tastebuds';

/* How much of a write-up goes under the name on a card. The blurbs run to 370
   characters and an unfurler cuts its own at somewhere between 200 and 300
   without asking where the words are, so this cuts first, and at a space. */
const MAX_CARD = 200;

function clip(text) {
  if (text.length <= MAX_CARD) return text;
  const cut = text.slice(0, MAX_CARD);
  const space = cut.lastIndexOf(' ');
  /* Half the budget, so a language that does not put spaces between its words
     gets a hard cut at the limit rather than a two-word card. */
  const kept = space > MAX_CARD / 2 ? cut.slice(0, space) : cut;
  return kept.replace(/[\s.,;:!?—–-]+$/, '') + '…';
}

/* An address on the map: the bare page; ?spot= for a place; &lang= for any
   language but English, which is what the file says without help. In that
   order, which is the order assets/app.js writes them into the address bar,
   so the address a crawler is given and the one a visitor copies are the
   same string. Nothing here invents an address the site did not have. */
function addressOf(request, lang, spot) {
  const url = new URL(canonical(request, '/'));
  if (spot) url.searchParams.set('spot', spot);
  if (lang !== DEFAULT_LANG) url.searchParams.set('lang', lang);
  return url.toString();
}

/* The write-up in this language, or the English one while the translation is
   still owed — tools/validate.mjs warns on a missing one rather than failing. */
function blurbOf(place, lang) {
  return place.blurb && (place.blurb[lang] || place.blurb[DEFAULT_LANG]) || '';
}

/* What the chips a place carries are called in this language. */
function kindsOf(place, types, lang) {
  return (place.types || []).map((id) => {
    const type = types.find((t) => t.id === id);
    return type ? (type[lang] || type[DEFAULT_LANG] || id) : id;
  });
}

/* A place's first photograph, on the live host even from a preview, for the
   reason functions/split.js gives about the mark: an unfurler is not a
   browser and does not resolve a relative URL, and a preview's address
   outlives nothing. Empty for a place that has none. */
function photoOf(place) {
  const photo = place.photos && place.photos[0];
  return photo
    ? SITE + '/photos/' + encodeURIComponent(place.id) + '/' + encodeURIComponent(photo)
    : '';
}

/* Every open place, in the alphabet — the one order that does not depend on
   where anybody is standing. assets/app.js draws its own order over this a
   moment later. */
function openPlaces(places) {
  const collator = new Intl.Collator('en', { sensitivity: 'base' });
  return places
    .filter((place) => !place.closed)
    .sort((a, b) => collator.compare(a.name, b.name));
}

/* ---------------------------------------------------------- the places
 * One place as text, for the reader that never runs the script — see the
 * header. The name links to the place's own address; then its kinds, its
 * street, its write-up and the dishes to order, all in the page's language.
 * `heading` is h3 in the list of seventy and h2 when the page is the place.
 * No classes: nothing styles it, because nothing ever shows it.
 */
function placeText(request, place, types, ui, lang, heading) {
  const blurb = blurbOf(place, lang);
  return '<' + heading + '><a href="' + esc(addressOf(request, lang, place.id)) + '">' +
      esc(place.name) + '</a></' + heading + '>' +
    '<p>' + esc(kindsOf(place, types, lang).join(' · ')) + '</p>' +
    '<address>' + esc(place.address) + '</address>' +
    (blurb ? '<p>' + esc(blurb) + '</p>' : '') +
    (place.mustOrder && place.mustOrder.length
      ? '<p>' + esc(ui.mustOrder) + ': ' + esc(place.mustOrder.join(', ')) + '</p>'
      : '');
}

/* The map's text: all seventy, each whole. */
function listOfPlaces(request, places, types, ui, lang) {
  return '<ol>' + openPlaces(places)
    .map((place) => '<li>' + placeText(request, place, types, ui, lang, 'h3') + '</li>')
    .join('') + '</ol>';
}

/* A place's text: that one whole, then the other sixty-nine by name, each
   linked to its own address. */
function onePlace(request, spot, places, types, ui, lang) {
  const others = openPlaces(places)
    .filter((place) => place.id !== spot.id)
    .map((place) => '<li><a href="' + esc(addressOf(request, lang, place.id)) + '">' + esc(place.name) + '</a></li>');
  return placeText(request, spot, types, ui, lang, 'h2') + '<ol>' + others.join('') + '</ol>';
}

/* ------------------------------------------------------ structured data
 * JSON-LD describing the page and what is on it, built from the same
 * restaurants.json the map draws from, so it can never drift out of sync
 * the way a hand-written block would. Closed places are left out: marking up
 * a business that no longer serves anyone is a false statement about the
 * world, not an SEO trick worth playing.
 */
function schemaType(place) {
  const types = place.types || [];
  if (types.indexOf('bakery') !== -1) return 'Bakery';
  if (types.indexOf('pub') !== -1) return 'BarOrPub';
  if (types.indexOf('coffee') !== -1) return 'CafeOrCoffeeShop';
  return 'Restaurant';
}

/* "Ankru 8, 11713 Tallinn" -> street, postcode and town as separate fields.
   Anything that does not match that shape is passed through whole. */
function postalAddress(address) {
  const out = { '@type': 'PostalAddress', addressCountry: 'EE' };
  const parts = String(address || '').split(',');
  const tail = (parts.length > 1 ? parts.pop() : '').trim();
  const code = tail.match(/^(\d{5})\s+(.+)$/);

  if (code) { out.postalCode = code[1]; out.addressLocality = code[2]; }
  else if (tail) { out.addressLocality = tail; }
  else { out.addressLocality = 'Tallinn'; }

  const street = parts.join(',').trim();
  if (street) out.streetAddress = street;
  return out;
}

/* One place, as schema.org sees it. */
function placeNode(request, place, lang) {
  const node = {
    '@type': schemaType(place),
    name: place.name,
    address: postalAddress(place.address),
    geo: { '@type': 'GeoCoordinates', latitude: place.lat, longitude: place.lng },
    url: addressOf(request, lang, place.id)
  };
  const blurb = blurbOf(place, lang);
  if (blurb) node.description = blurb;
  if (place.phone) node.telephone = place.phone;
  const photo = photoOf(place);
  if (photo) node.image = photo;
  /* priceRange takes a run of euro signs, and half a sign is not something
     it can express, so a half step rounds up to the nearer whole band. */
  if (place.price) node.priceRange = '\u20ac'.repeat(Math.round(place.price));
  return node;
}

/* The site, and then either the one place this page is or the list of all
   of them. */
function structuredData(request, places, ui, lang, spot) {
  const site = addressOf(request, lang);
  const graph = [{
    '@type': 'WebSite',
    '@id': site + '#website',
    url: site,
    name: 'Tallinn Tastebuds',
    inLanguage: lang,
    description: ui.tagline,
    sameAs: ['https://www.instagram.com/tallinntastebuds/']
  }];

  if (spot) {
    graph.push(placeNode(request, spot, lang));
  } else {
    const items = openPlaces(places).map((place, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      item: placeNode(request, place, lang)
    }));
    graph.push({
      '@type': 'ItemList',
      name: ui.documentTitle,
      inLanguage: lang,
      numberOfItems: items.length,
      itemListOrder: 'https://schema.org/ItemListUnordered',
      itemListElement: items
    });
  }

  return { '@context': 'https://schema.org', '@graph': graph };
}

/* ------------------------------------------------------------- the card
 * What an unfurler reads: the site's own for the map, and the place's for a
 * place — see the header for the four decisions. The map's title and
 * description double as its card, since the site is the thing being shared.
 */
function card(request, spot, ui, lang, self) {
  if (!spot) {
    return [
      '<meta property="og:type" content="website">',
      '<meta property="og:url" content="' + esc(self) + '">',
      '<meta property="og:site_name" content="Tallinn Tastebuds">',
      '<meta property="og:title" content="' + esc(ui.documentTitle) + '">',
      '<meta property="og:description" content="' + esc(ui.tagline) + '">',
      '<meta property="og:image" content="' + SITE + '/assets/logo/og.jpg">',
      '<meta property="og:image:width" content="1200">',
      '<meta property="og:image:height" content="630">',
      '<meta name="twitter:card" content="summary_large_image">'
    ];
  }

  /* A place that has shut keeps its pin and its link — closedNote in
     data/ui.json promises exactly that — so the card says so before the
     write-up sells a kitchen that is not cooking. */
  const said = blurbOf(spot, lang) || spot.address || '';
  const description = clip(spot.closed && ui.closedFlag ? ui.closedFlag + '. ' + said : said);
  const photo = photoOf(spot);

  return [
    /* A restaurant at a coordinate is a place, which is a type Open Graph
       already has and the two properties under it are what it is for. */
    '<meta property="og:type" content="place">',
    '<meta property="place:location:latitude" content="' + esc(spot.lat) + '">',
    '<meta property="place:location:longitude" content="' + esc(spot.lng) + '">',
    '<meta property="og:url" content="' + esc(self) + '">',
    '<meta property="og:site_name" content="Tallinn Tastebuds">',
    /* The name on its own. og:site_name beside it already says where the link
       leads, so the suffix the <title> carries would spend the front of the
       card saying it a second time — the argument functions/split.js makes for
       a group's name, and a restaurant's is no less the point of the card. */
    '<meta property="og:title" content="' + esc(spot.name) + '">',
    '<meta property="og:description" content="' + esc(description) + '">',
    ...(photo ? [
      '<meta property="og:image" content="' + esc(photo) + '">',
      /* The name and nothing more. It is the one description of the picture
         that is true of all of them — a photograph of this place — without
         claiming which of the room, the plate or the sign it is, and being a
         proper noun it needs no translating into the card's language. */
      '<meta property="og:image:alt" content="' + esc(spot.name) + '">'
    ] : [
      '<meta property="og:image" content="' + SITE + '/assets/logo/og.jpg">',
      '<meta property="og:image:width" content="1200">',
      '<meta property="og:image:height" content="630">'
    ]),
    '<meta name="twitter:card" content="summary_large_image">'
  ];
}

export async function onRequest(context) {
  const { request } = context;

  /* The page, and the headers _headers gives it — see the header. */
  const res = await context.next();

  let languages;
  let taxonomy;
  let places;
  try {
    [languages, taxonomy, places] = await Promise.all([
      dataFile(context, '/data/ui.json'),
      dataFile(context, '/data/taxonomy.json'),
      mapPlaces(context)
    ]);
  } catch (e) {
    return res;
  }

  const params = new URL(request.url).searchParams;
  const asked = params.get('lang');
  const lang = asked && Object.prototype.hasOwnProperty.call(languages, asked) ? asked : DEFAULT_LANG;
  const ui = languages[lang];
  /* The place this address stands on, if it is one the map knows — and
     whether that makes it a page, which a closed place is not. */
  const wanted = params.get('spot');
  const spot = wanted ? places.find((place) => place.id === wanted) || null : null;
  const page = spot && !spot.closed ? spot : null;

  const self = addressOf(request, lang, page && page.id);
  const title = spot ? spot.name + SUFFIX : ui.documentTitle;
  const description = page ? blurbOf(page, lang) || ui.metaDescription : ui.metaDescription;

  let html = rehead(await res.text(), [
    '<title>' + esc(title) + '</title>',
    '<meta name="description" content="' + esc(description) + '">',
    '<link rel="canonical" href="' + esc(self) + '">',
    /* Every language's address for this same page, on every language's
       page — a search engine only trusts the set when each page returns it
       whole, itself included. x-default is where somebody whose language is
       none of the ten lands, which is the English page, the same as it
       always was. Sorted by code, the way the switcher lists them. */
    '<link rel="alternate" hreflang="x-default" href="' + esc(addressOf(request, DEFAULT_LANG, page && page.id)) + '">',
    ...Object.keys(languages).sort().map((code) =>
      '<link rel="alternate" hreflang="' + esc(code) + '" href="' + esc(addressOf(request, code, page && page.id)) + '">'),
    ...card(request, spot, ui, lang, spot ? addressOf(request, lang, spot.id) : self),
    '<script type="application/ld+json">' + seed(structuredData(request, places, ui, lang, page)) + '</script>'
  ].join('\n'));

  /* The two things outside the head block, both for the reader that never
     runs the script: the language on the root element, which assets/app.js
     sets too once it runs, and the places as text, which it empties before
     drawing its own rows. Both are exact matches on the static markup, and
     tools/validate.mjs holds index.html to the second so that a page edit
     cannot quietly leave a crawler with an empty list again. */
  if (lang !== DEFAULT_LANG) {
    html = html.replace('<html lang="' + DEFAULT_LANG + '">', '<html lang="' + esc(lang) + '">');
  }
  html = fill(html, EMPTY['index.html'], page
    ? onePlace(request, page, places, taxonomy.types, ui, lang)
    : listOfPlaces(request, places, taxonomy.types, ui, lang));

  /* The response this page would have had, minus its ETag, which is a hash
     of a document with a different head on it, and minus a Content-Length
     measured before the swap. */
  const headers = new Headers(res.headers);
  headers.delete('etag');
  headers.delete('content-length');
  return new Response(html, { status: res.status, headers });
}
