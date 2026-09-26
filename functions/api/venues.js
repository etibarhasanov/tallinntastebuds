/**
 * Tallinn Tastebuds — the Google Places directory, as its own answer.
 *
 * GET /api/venues?ids=… and ?map=…, and GET /api/admin/venues
 *
 * Every place in this city you can eat or drink in, out of `google_venues` —
 * the Google Places export mirrored into D1, eleven hundred and eleven rows,
 * see db/schema.sql. The whole roll is what /admin/google draws, answered by
 * ./admin/venues.js to the owner alone; this route answers the two narrow
 * asks — a handful of rows at a time through `?ids=`, where the map's find
 * bar gets the contact half of a venue somebody has just looked up, and the
 * one row `?map=` names.
 *
 * WHY THIS IS NOT /api/places
 *
 * They read the same table and answer different questions, which is why there
 * are two of them rather than one with a flag on it:
 *
 *   /api/places   the roll a list is built from, and the one the map's find
 *                 bar searches. The map's own places merged over the export,
 *                 Google's row dropped wherever it is a place I have already
 *                 been to, and stripped to what a picker row and a search
 *                 need — name, address, pin, and the kinds a row is filed
 *                 under.
 *
 *   /api/venues   Google's description of Tallinn, whole and unmerged. The
 *                 rating, the review count, where the two of them together put
 *                 the place among all eleven hundred, the price band, the
 *                 phone, the website and the week's opening hours, for all
 *                 1,111 rows at once — which is what a directory filters and
 *                 sorts on, and what the picker deliberately leaves behind.
 *
 * venuesByIds() in _lib.js hands the map that same contact half for a place on
 * somebody's list, a handful of rows at a time. This is the other shape of the
 * same need: everything, in one answer, so a filter can run over it. Both read
 * the week through venueHours() in that file, so there is one parser of that
 * column and not two.
 *
 * Merging would be actively wrong here. The sixty places that are on both
 * rolls are the interesting ones on this page — they are the rows that link
 * through to a write-up — so they carry `mapId` and stay where Google filed
 * them, rather than being replaced by my entry for them.
 *
 * ONE ANSWER, AND THE PAGE DOES THE FILTERING
 *
 * The whole roll goes out in one response, to the owner alone and never
 * cached — see WHO MAY ASK FOR WHAT below — and the page narrows it in the
 * browser. That is not laziness about SQL: the page draws a map of every
 * match beside the list, so it needs every matching pin whatever the filter
 * says, and "open now" is a question about a week of opening hours rather
 * than something a WHERE clause can answer. A filtered endpoint would mean a
 * round trip per keystroke to hand back most of the same rows.
 *
 * ONE EXCEPTION, AND IT IS A HANDFUL OF ROWS AND NOT A FILTER
 *
 * `?ids=` names venues by their Google key, comma separated, and answers only
 * those. It is not the filtered endpoint the paragraph above argues against:
 * nothing searches with it, because a search that has to reach the database
 * cannot fold Põhjala down to pohjala on the way — see the find bar in
 * assets/app.js, which folds the roll behind /api/places in the browser for
 * exactly that reason. This is the step after the search, when one venue has
 * been picked and the map wants the half /api/places leaves behind: the phone,
 * the website and the week.
 *
 * It answers rows in the shape above and not a second one — the same roll(),
 * the same entry(), the same absent-means-absent rule, and the same `rank`
 * probe — because a route that answers two shapes is a route every reader has
 * to ask which it is holding. Fifty ids at most, which is venuesByIds()' cap
 * in _lib.js written again here rather than borrowed: that helper builds the
 * card the lists and the chat draw, and this route builds a directory row, so
 * they share the ceiling and nothing else.
 *
 * AND ONE MORE, WHICH IS ONE ROW AND ASKED FROM THE OTHER SIDE
 *
 * `?map=` names a place on my map by its data/restaurants.json id and answers
 * the Google row filed against it through `map_id`, or nothing — an empty
 * array, the same as `?ids=` naming a key the table does not hold. It is what
 * the map's panel for a place of mine asks when it opens, for the section
 * under the write-up that says what Google makes of the same door: the score,
 * where the score puts it, the week and the listing. See **Google, on a place
 * of mine** in README.md for why a map that ranks nothing now prints that.
 *
 * Same row shape again, with one field only this half carries: `of`, how many
 * rows the last sync carried, so the panel can say "#42 of 1,111" without the
 * eleven hundred rows /admin/google counts to get the same number. Every row the
 * export holds, closed and hidden ones included, because that is the roll
 * ranked() in tools/googlevenues.mjs numbered — and deliberately not
 * MAX(rank), which reads the same on a database that took the whole file and
 * says "of 300" on one where a load stopped after six batches, as both did
 * in September 2026. A row whose rank did not arrive sends no `rank`, and the
 * panel prints no line for it. The directory sends no `of` — it counts what it
 * has, and eleven hundred copies of one number is sixteen kilobytes of nothing.
 *
 * The directory's filter applies here rather than the `?ids=` half's absence
 * of one: a row switched off with `hidden`, or one the last sync no longer
 * carried, has nothing current to say about a place that is still on the map.
 *
 * WHO MAY ASK FOR WHAT
 *
 * The whole roll is the owner's. It is every row of the export in one answer
 * — every phone number, website and week of opening hours, a few hundred
 * kilobytes — and a public address that hands that over to anybody who asks
 * is a scraper's afternoon saved. So it is answered at /api/admin/venues,
 * behind the lock every /api/admin/ address has in functions/_middleware.js,
 * `no-store`; here, an address with neither `?ids=` nor `?map=` is a 404.
 *
 * `?ids=` and `?map=` stay here and open, because the map itself asks them
 * for anybody who opens a place: fifty rows at most, named one at a time by a
 * key the asker already has. They keep their five minutes of public cache.
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
  /* The pan-Asian rows, and it earns its place beside the eight above:
     twenty-seven places say only this and nothing more exact. */
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

/* One row as the page draws it. See the note at the top about empty fields:
   everything here is added only when there is something to add. */
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
  /* Where this place stands in the whole export once Google's rating is
     weighed by Google's review count — db/schema.sql has the arithmetic and
     ranked() in tools/googlevenues.mjs computes it. Absent on a database the
     ALTER has not reached yet, and absent on a row Google gave no numbers
     for; the page prints nothing either way. */
  if (typeof row.rank === 'number') out.rank = row.rank;
  /* Only `?map=` asks for this — see the note at the top. */
  if (typeof row.ranked === 'number') out.of = row.ranked;
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

  /* Sixty of these are also places on my map, and on this page that is
     the most interesting thing a row can say: it is what turns "Google rates
     this 4.6" into a link to somewhere I have actually eaten. */
  if (row.map_id) out.mapId = row.map_id;
  /* Kept in the answer rather than filtered out of it, unlike /api/places,
     which is a picker and should not offer somewhere shut. A directory that
     silently omitted the sixty-five places Google says are temporarily closed
     would have somebody walking to one to find out. */
  if (row.status === 'Temporarily closed') out.closed = true;

  return out;
}

/* Whether google_venues has the `rank` column, remembered for the life of the
   isolate. `undefined` until the first answer has been asked for.

   db/schema.sql is CREATE TABLE IF NOT EXISTS and nothing in CI applies it, so
   the column arrives by a hand-run ALTER on each database — and the code is
   live the moment the branch lands, which is some minutes or some hours
   before anybody runs it. A SELECT naming a column that is not there throws,
   and this route has nothing to fall back on: the whole directory would be a
   503 saying the city has no restaurants in it, over a number on a card.

   So it is asked once and then known, which is readingPins()' arrangement in
   _pins.js for the same reason. Only "no such column" is caught; a database
   that is down is still a database that is down. */
let ranks;

/* One query builder for every answer this route gives, so the whole roll,
   `?ids=` and `?map=` cannot drift into selecting different halves of the
   same row — and so the rank probe above covers all three rather than only
   the roll it was written for. `ids` picks which rows: null is the directory,
   a list of Google keys is the find bar asking after the one venue it has
   been used to look up. `mine` is a map id instead, and wins over both. */
function roll(env, withRank, ids, mine) {
  const sql =
    'SELECT place_id, name, category, cuisine, tags, rating, reviews, price, status, ' +
    'address, postal_code, city, phone, website, opening_hours, latitude, longitude, map_id' +
    (withRank ? ', rank' : '') +
    (withRank && mine ? ', (SELECT COUNT(*) FROM google_venues WHERE missing_since IS NULL) AS ranked' : '') + ' ' +
    'FROM google_venues ' +
    (mine
      /* LIMIT 1 because nothing stops two rows carrying the same map_id — the
         matcher only ever fills an empty one, but a hand-set one could — and
         a panel has one place on it. The directory's filter, for the reason
         at the top. */
      ? 'WHERE map_id = ? AND hidden = 0 AND missing_since IS NULL LIMIT 1'
      : ids
      /* No hidden/missing clause on this half, and that is deliberate. It
         answers a venue somebody has already been shown and has pressed;
         dropping it here would be the map offering a row in the morning and
         failing to dress it in the afternoon. The other half is what decides
         which venues are offered at all. */
      ? 'WHERE place_id IN (' + ids.map(() => '?').join(', ') + ')'
      /* hidden is the curation switch — a duplicate, or a car park Google
         thinks is a restaurant. missing_since is a row the last sync no
         longer carried, kept because a list may point at it but not
         something to put in front of anybody as somewhere to go. */
      : 'WHERE hidden = 0 AND missing_since IS NULL');

  const statement = env.DB.prepare(sql);
  if (mine) return statement.bind(mine).all();
  return (ids ? statement.bind(...ids) : statement).all();
}

async function readingRanks(env, ids, mine) {
  if (ranks === false) return roll(env, false, ids, mine);
  try {
    const out = await roll(env, true, ids, mine);
    ranks = true;
    return out;
  } catch (e) {
    if (!/no such column/i.test(String((e && e.message) || e))) throw e;
    ranks = false;
    return roll(env, false, ids, mine);
  }
}

/* What `?ids=` is allowed to ask for. A Google key is letters, digits, hyphens
   and underscores — 215 of the 1,110 carry one — so anything else in the list
   is dropped rather than bound, and the whole parameter is worth at most fifty
   rows. Deduplicated, because a page that asks for the same venue twice should
   not be able to make the database say it twice. */
function wantedIds(raw) {
  const seen = new Set();
  for (const part of String(raw || '').split(',')) {
    const id = part.trim();
    if (!id || id.length > 128 || !/^[A-Za-z0-9_-]+$/.test(id)) continue;
    seen.add(id);
    if (seen.size >= 50) break;
  }
  return [...seen];
}

/* The rows every answer is made of, in the directory's shape: the whole roll
   when `ids` and `mine` are both null, the named venues or the one place of
   mine otherwise. Throws when the database does; the route decides what that
   looks like. Exported because the whole roll is answered from
   ./admin/venues.js, and one reader of the table is what keeps the two from
   drifting into different shapes. */
export async function venueRows(env, ids, mine) {
  const { results } = await readingRanks(env, ids, mine);

  /* In whatever order the database hands them back, and deliberately not
     sorted here. The page offers three orders and applies one of them to every
     answer before it draws a card, so a sort on the way out would be a second
     opinion about the order that nothing ever sees — and one that would drift
     from the page's the first time either changed. */
  return (results || [])
    .filter((row) => row && typeof row.name === 'string' && row.name)
    .map(entry);
}

export async function onRequestGet(context) {
  const { env, request } = context;

  /* The whole roll is not answered here any more — see WHO MAY ASK FOR WHAT
     in the header — so an address that names neither half is asking for
     something that lives at /api/admin/venues, and is told there is nothing
     here. Before the database, so it costs nothing. */
  const asked = new URL(request.url).searchParams;
  if (!asked.has('ids') && !asked.has('map')) return json({ error: 'not-found' }, 404);

  /* Nothing to fall back on here: a database that cannot answer means the
     map's panel has nothing to add, and it draws without it. */
  if (!env.DB || (await wrongDatabase(env))) return json({ error: 'venues' }, 503);

  /* Named venues, when the address asks for them. `?ids=` with nothing usable
     in it is an empty answer and not the whole roll: somebody asking for two
     venues and getting eleven hundred is a worse surprise than an empty list,
     and the map's find bar reads it as a venue it could not dress. */
  const ids = asked.has('ids') ? wantedIds(asked.get('ids')) : null;
  if (ids && !ids.length) return json([], 200, 300);

  /* A place of mine, when the address names one. A map id is lowercase
     letters, digits and hyphens, and anything else is an empty answer for the
     reason an unusable `?ids=` is one. */
  const mine = asked.has('map') ? String(asked.get('map') || '').trim() : null;
  if (mine !== null && !/^[a-z0-9-]{1,80}$/.test(mine)) return json([], 200, 300);

  try {
    return json(await venueRows(env, ids, mine), 200, 300);
  } catch (e) {
    return json({ error: 'venues' }, 503);
  }
}
