/**
 * Tallinn Tastebuds — the Google Places directory, as its own answer.
 *
 * GET /api/venues
 *
 * Every place in this city you can eat or drink in, out of `google_venues` —
 * the Google Places export mirrored into D1, eleven hundred and ten rows,
 * see db/schema.sql. It is what /google draws and the only thing that
 * asks for it.
 *
 * WHY THIS IS NOT /api/places
 *
 * They read the same table and answer different questions, which is why there
 * are two of them rather than one with a flag on it:
 *
 *   /api/places   the roll a list is built from. The map's own places merged
 *                 over the export, Google's row dropped wherever it is a place
 *                 I have already been to, and stripped to the five fields a
 *                 picker row needs — name, address, pin.
 *
 *   /api/venues   Google's description of Tallinn, whole and unmerged. The
 *                 rating, the review count, the price band, the phone, the
 *                 website and the week's opening hours, for all 1,110 rows at
 *                 once — which is what a directory filters and sorts on, and
 *                 what the picker deliberately leaves behind.
 *
 * venuesByIds() in _lib.js hands the map that same contact half for a place on
 * somebody's list, a handful of rows at a time. This is the other shape of the
 * same need: everything, in one answer, so a filter can run over it. Both read
 * the week through venueHours() in that file, so there is one parser of that
 * column and not two.
 *
 * Merging would be actively wrong here. The sixty-one places that are on both
 * rolls are the interesting ones on this page — they are the rows that link
 * through to a write-up — so they carry `mapId` and stay where Google filed
 * them, rather than being replaced by my entry for them.
 *
 * ONE ANSWER, CACHED, AND THE PAGE DOES THE FILTERING
 *
 * No query parameters. The whole roll goes out in one response with five
 * minutes on it, exactly as /api/places does, and the page narrows it in the
 * browser. That is not laziness about SQL: the page draws a map of every match
 * beside the list, so it needs every matching pin whatever the filter says, and
 * "open now" is a question about a week of opening hours rather than something
 * a WHERE clause can answer. A filtered endpoint would mean a round trip per
 * keystroke to hand back most of the same rows.
 *
 * EMPTY FIELDS ARE NOT SENT
 *
 * One rule for the whole answer: a field with nothing in it is left out rather
 * than sent as "", null or false. A hundred and eighteen rows have no price, a
 * hundred and forty-three no website, seventy-seven no opening hours at all,
 * and spelling each of those out costs more than the values do. The page reads
 * every one of them as absent.
 */

import { json, wrongDatabase, venueHours } from './_lib.js';

/* Google's words for what a place cooks, in ids the site can say in ten
 * languages. data/cuisines.json carries the labels; this is the only thing
 * that decides which ids a row gets.
 *
 * IT IS NOT VENUE_TYPES IN _lib.js, AND THE DIFFERENCE IS THE POINT
 *
 * That table answers "which of the map's own types is this", because a list
 * row drawn from the export has to sit beside places from data/restaurants.json
 * and be described in the same seven words. This one answers "what would you
 * come here to eat", which is a directory's question and needs a directory's
 * vocabulary: `japanese` and `thai` where the map says `asian`, `pizza` and
 * `burgers` where it says `restaurant`.
 *
 * Category, cuisine and the leftover tags are matched as one lowercased string
 * — see said() below for how they are joined and why — so "Pizza Restaurant;
 * Italian Restaurant" is both of those. A row can carry several and 232 of them
 * do, up to six; 249 carry none at all, and nearly all of those are the rows
 * where Google says only "Restaurant" and nothing else — the remainder are a
 * handful of bistros and family restaurants, and the barber, the theatre and
 * the sports club the wider sweep dragged in — so no kitchen is a truthful
 * answer rather than a gap.
 *
 * Every pattern below matches at least one row of the export as it stands, and
 * tools/validate.mjs fails the build if one stops doing so — the same standard
 * VENUE_TYPES is held to, and the reason "european" is not in the table. Google
 * hangs it on a hundred and four rows as the parent of Italian, French and
 * Greek, so a chip for it would return mostly pizzerias while saying nothing a
 * more exact chip does not already say.
 */
export const KITCHENS = [
  ['japanese',         /japanese|sushi|ramen|izakaya|yakitori|teppan|onigiri/],
  ['korean',           /korean/],
  ['chinese',          /chinese|dim sum|sichuan/],
  ['thai',             /\bthai\b/],
  ['vietnamese',       /vietnamese|\bpho\b/],
  ['indonesian',       /indonesian/],
  ['malaysian',        /malaysian/],
  ['filipino',         /filipino/],
  ['taiwanese',        /taiwanese|bubble tea/],
  ['indian',           /indian|curry|tandoor/],
  /* The pan-Asian rows, and it earns its place beside the eight above: twenty
     three places say only this and nothing more exact. */
  ['asian',            /\basian\b|noodle|dumpling|wok/],
  ['middle-eastern',   /middle eastern|kebab|shawarma|falafel|lebanese|hummus/],
  ['turkish',          /turkish|doner|pide|baklava/],
  ['italian',          /italian|pasta|trattoria|osteria/],
  ['pizza',            /pizza/],
  ['burgers',          /hamburger|burger/],
  /* Not latin_american_restaurant or south_american_restaurant. Google types
     three places that way — two Argentinian steakhouses and a seafood
     restaurant — and none of the three is anybody's idea of American food, so
     the chip was three rows of nonsense out of sixty-four. A lookbehind rather
     than \b, because the word boundary is there in "latin american": it is the
     neighbouring word that says the claim is not being made. */
  ['american',         /(?<!latin |south |central |north )american|hot dog|wings/],
  ['barbecue',         /barbecue|\bbbq\b|smokehouse/],
  ['mexican',          /mexican|taco|burrito|tex-mex/],
  ['spanish',          /spanish|tapas|paella/],
  ['french',           /french|creperie|brasserie/],
  ['greek',            /greek|gyros|souvlaki/],
  ['portuguese',       /portuguese/],
  ['german',           /german|schnitzel/],
  ['belgian',          /belgian|waffle/],
  ['nordic',           /nordic|scandinavian/],
  ['eastern-european', /eastern european|polish|baltic|estonian/],
  ['ukrainian',        /ukrainian/],
  ['russian',          /russian|uzbek|pelmeni/],
  ['mediterranean',    /mediterranean/],
  ['peruvian',         /peruvian|ceviche/],
  ['argentinian',      /argentin/],
  ['hawaiian',         /hawaiian|poke/],
  ['steakhouse',       /steak/],
  ['seafood',          /seafood|oyster|\bfish\b/],
  ['vegan',            /vegan|vegetarian/],
  ['bakery',           /bakery|pastry|donut|dessert|confectionery|patisserie/],
  ['coffee',           /\bcafe\b|coffee|tea house|cafeteria/],
  /* Beer, and only beer. This used to carry \bbar\b as well, which Google hangs
     on any restaurant with a drinks licence: it would file 202 places under
     the map's word for a beer hall, of which 30 have a beer word and the rest
     are wine bars, cocktail bars, and a ramen shop. See `bar` below for where
     those went. */
  ['pub',              /\bpub\b|brewpub|brewery|\bbeer\b|gastropub/],
  /* Everywhere you would go for the drink rather than the meal, and the one
     pattern in this table that cares which column a word came from. "Bar" in
     the category is what the place IS — "Bar", "Oyster Bar Restaurant",
     "Hookah Bar" — and `^[^|]*` is what holds it there, because said() keeps
     the three columns apart with a pipe. "Bar" in the tags is what the place
     also HAS, which for Kanuti Ramen Bar and a burger place called Hungry Papa
     is a drinks licence and nothing anybody is choosing them for.

     Cocktail, wine and hookah are named outright because those three do say
     what somebody is going out for, wherever Google files them. Bare `wine` is
     not: it would take in the wine shops. */
  ['bar',              /^[^|]*\bbar\b|cocktail|wine bar|hookah/],
  ['fast-food',        /fast food|takeout|street food|sandwich|snack/],
  ['breakfast',        /breakfast|brunch|pancake/],
  ['buffet',           /buffet/],
  ['fine-dining',      /fine dining/]
];

/* One row as the page draws it. See the note at the top about empty fields:
   everything here is added only when there is something to add. */
/* The three columns a kitchen is decided from, lowercased and kept apart.
 *
 * The pipe is load-bearing for exactly one pattern — `bar`, which has to know
 * whether the word was Google's category or one of its tags — and harmless to
 * the other forty-three, none of which spans a column boundary. Measured: not
 * one of them matches a different set of rows for the separator being there.
 *
 * Exported because tools/validate.mjs holds every pattern in this table to
 * still matching a row of the export, and it has to ask that question of the
 * same string this does. Two copies of this line would be two copies that
 * drift, and the check would then be passing on a haystack the site does not
 * build.
 */
export function said(row) {
  return [row.category, row.cuisine, row.tags]
    .map((part) => String(part || '').toLowerCase())
    .join(' | ');
}

/* A row's kitchens, in the order a card should say them.
 *
 * Two orders at once, which is why this is a function now rather than the
 * filter it was written as. KITCHENS runs from the most exact word to the
 * broadest, which is the right order between two words Google is equally sure
 * about. It is the wrong one between a word out of Google's own category or
 * cuisine — what the place IS — and a word out of the tag list, which is
 * everything a place also happens to have. Siga la Vaca is typed
 * argentinian_restaurant first and korean_restaurant fifth; the page prints the
 * first two of these and nothing more, so filing "Korean" above "Argentinian"
 * because korean sits thirty rows higher up the table put a wrong sentence on a
 * card about a steakhouse.
 *
 * So the two leading columns win outright, and the table's order decides inside
 * each group. Both tests are made against the same pipe-joined string rather
 * than the columns apart, with the tags cut off the end for the first group,
 * because `bar` is anchored to the category with ^[^|]* and would answer
 * differently if it were handed a column on its own.
 */
export function kitchensOf(row) {
  const whole = said(row);
  const primary = whole.split(' | ').slice(0, 2).join(' | ');
  const first = [];
  const rest = [];
  for (const [id, pattern] of KITCHENS) {
    if (!pattern.test(whole)) continue;
    (pattern.test(primary) ? first : rest).push(id);
  }
  return first.concat(rest);
}

function entry(row) {
  const where = [row.address, [row.postal_code, row.city].filter(Boolean).join(' ')]
    .map((part) => String(part || '').trim())
    .filter(Boolean)
    .join(', ');

  const out = {
    id: row.place_id,
    name: row.name,
    kitchens: kitchensOf(row)
  };

  if (where) out.address = where;
  if (typeof row.rating === 'number') out.rating = row.rating;
  if (typeof row.reviews === 'number') out.reviews = row.reviews;
  /* Google's "$" to "$$$$" as the map's band of four, which is the one place
     this conversion is needed — db/schema.sql keeps the string verbatim so the
     mirror does not store an opinion. */
  if (/^\$+$/.test(row.price || '')) out.price = String(row.price).length;
  if (typeof row.latitude === 'number') out.lat = row.latitude;
  if (typeof row.longitude === 'number') out.lng = row.longitude;
  if (row.phone) out.phone = row.phone;
  if (row.website) out.website = row.website;

  /* Google's one-line week as seven days of the times themselves, Monday
     first, out of the parser the map's own card for one of these places
     already uses. Two things wanted the same column read the same way and
     there is only one function that does it. The strings are digits and a
     hyphen and carry no language, which is the whole reason they can travel
     verbatim; assets/venues.js turns them into minutes to answer "open now"
     and prints them as they are. */
  const week = venueHours(row.opening_hours);
  if (week.length) out.hours = week;

  /* Thirty-two of these are also places on my map, and on this page that is
     the most interesting thing a row can say: it is what turns "Google rates
     this 4.6" into a link to somewhere I have actually eaten. */
  if (row.map_id) out.mapId = row.map_id;
  /* Kept in the answer rather than filtered out of it, unlike /api/places,
     which is a picker and should not offer somewhere shut. A directory that
     silently omitted the sixty-six places Google says are temporarily closed
     would have somebody walking to one to find out. */
  if (row.status === 'Temporarily closed') out.closed = true;

  return out;
}

export async function onRequestGet(context) {
  const { env } = context;

  /* Nothing to fall back on here. The map's own places are a roll of
     seventy-five and this page is a directory of everywhere else, so a
     database that cannot answer means the page has nothing — and it says so,
     rather than drawing an empty directory that reads as a city with no
     restaurants in it. */
  if (!env.DB || (await wrongDatabase(env))) return json({ error: 'venues' }, 503);

  let results;
  try {
    ({ results } = await env.DB
      .prepare(
        'SELECT place_id, name, category, cuisine, tags, rating, reviews, price, status, ' +
        'address, postal_code, city, phone, website, opening_hours, latitude, longitude, map_id ' +
        'FROM google_venues ' +
        /* hidden is the curation switch — a duplicate, or a car park Google
           thinks is a restaurant. missing_since is a row the last sync no
           longer carried, kept because a list may point at it but not
           something to put in front of anybody as somewhere to go. */
        'WHERE hidden = 0 AND missing_since IS NULL'
      )
      .all());
  } catch (e) {
    return json({ error: 'venues' }, 503);
  }

  /* In whatever order the database hands them back, and deliberately not
     sorted here. The page offers three orders and applies one of them to every
     answer before it draws a card, so a sort on the way out would be a second
     opinion about the order that nothing ever sees — and one that would drift
     from the page's the first time either changed. */
  const out = (results || [])
    .filter((row) => row && typeof row.name === 'string' && row.name)
    .map(entry);

  return json(out, 200, 300);
}
