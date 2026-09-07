/**
 * Tallinn Tastebuds — the Google Places directory, as its own answer.
 *
 * GET /api/venues
 *
 * Every place in this city you can eat or drink in, out of `google_venues` —
 * the Google Places export mirrored into D1, seven hundred and fifty-one rows,
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
 *                 website and the week's opening hours, for all 751 rows at
 *                 once — which is what a directory filters and sorts on, and
 *                 what the picker deliberately leaves behind.
 *
 * venuesByIds() in _lib.js hands the map that same contact half for a place on
 * somebody's list, a handful of rows at a time. This is the other shape of the
 * same need: everything, in one answer, so a filter can run over it. Both read
 * the week through venueHours() in that file, so there is one parser of that
 * column and not two.
 *
 * Merging would be actively wrong here. The thirty-two places that are on both
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
 * than sent as "", null or false. Fifty-seven rows have no price, eighty-one no
 * website, fifty-two no opening hours at all, and spelling each of those out
 * costs more than the values do. The page reads every one of them as absent.
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
 * Category, cuisine and the leftover tags are matched as one lowercased
 * string, so "Bar & Grill" is a pub and "Pizza Restaurant; Italian Restaurant"
 * is both. A row can carry several and 244 of them do; 213 carry none at all,
 * and those are the rows where Google says only "Restaurant" and nothing else,
 * so no kitchen is a truthful answer rather than a gap.
 *
 * Every pattern below matches at least one row of the export as it stands, and
 * tools/validate.mjs fails the build if one stops doing so — the same standard
 * VENUE_TYPES is held to, and the reason "european" is not in the table. Google
 * hangs it on ninety-five rows as the parent of Italian, French and Greek, so a
 * chip for it would return mostly pizzerias while saying nothing a more exact
 * chip does not already say.
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
  ['american',         /american|hot dog|wings/],
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
  ['pub',              /\bbar\b|\bpub\b|brewpub|brewery|beer|wine|cocktail|hookah/],
  ['fast-food',        /fast food|takeout|street food|sandwich|snack/],
  ['breakfast',        /breakfast|brunch|pancake/],
  ['buffet',           /buffet/],
  ['fine-dining',      /fine dining/]
];

/* One row as the page draws it. See the note at the top about empty fields:
   everything here is added only when there is something to add. */
function entry(row) {
  const said = [row.category, row.cuisine, row.tags].join(' ').toLowerCase();
  const where = [row.address, [row.postal_code, row.city].filter(Boolean).join(' ')]
    .map((part) => String(part || '').trim())
    .filter(Boolean)
    .join(', ');

  const out = {
    id: row.place_id,
    name: row.name,
    kitchens: KITCHENS.filter((pair) => pair[1].test(said)).map((pair) => pair[0])
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
     silently omitted the forty-five places Google says are temporarily closed
     would have somebody walking to one to find out. */
  if (row.status === 'Temporarily closed') out.closed = true;

  return out;
}

export async function onRequestGet(context) {
  const { env } = context;

  /* Nothing to fall back on here. The map's own places are a roll of
     seventy-four and this page is a directory of everywhere else, so a
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
     sorted here. The page offers four orders and applies one of them to every
     answer before it draws a card, so a sort on the way out would be a second
     opinion about the order that nothing ever sees — and one that would drift
     from the page's the first time either changed. */
  const out = (results || [])
    .filter((row) => row && typeof row.name === 'string' && row.name)
    .map(entry);

  return json(out, 200, 300);
}
