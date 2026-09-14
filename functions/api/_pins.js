/**
 * Tallinn Tastebuds — what a pin is, and which of them a list may wear.
 *
 * Underscore-prefixed, so this is a module and never a route.
 *
 * THE MOUTH IS NOT ON THIS LIST, AND THAT IS THE POINT
 *
 * Every place on my map draws the mark — the mouth out of the painting, see
 * **The mark** in README.md — and nothing anybody types can put it on a place
 * that is not. It is the one thing on this site that means "I have eaten here
 * and it is worth your evening", so it is not an option in a picker; it is
 * what being on the map looks like. A list wears one of the eight markers
 * below instead, and a place on that list which is also on my map keeps the
 * mouth regardless of what the list chose.
 *
 * AND NEITHER IS A CUP, A CROISSANT OR A BURGER
 *
 * Those are the other table, and it is not in this file at all. A Google row
 * draws what kind of door it is — five of them, see PLACES in assets/pins.js
 * — and that is the site describing a place rather than somebody choosing
 * something about it. The eight below are symbols: a pin, a flame, a flag.
 * They mark a spot, which is the one thing true of every place on a top ten,
 * and they make no claim about what any of them cooks.
 *
 * Keeping the two apart is what stops a list wearing a croissant from
 * putting a croissant on a sushi place, which reads as the map being wrong
 * about the sushi place rather than as the list being somebody's. So only
 * the markers are here, and cleanPin() refuses a cup for the same reason it
 * refuses the mouth: that word is not this person's to say.
 *
 * WHY THE IDS ARE HERE AND THE DRAWING IS NOT
 *
 * assets/pins.js is the other half: the same eight ids, plus the emoji each
 * one draws, the five kinds of place, and the table that reads a Google
 * venue's words into one of those. It cannot import this file — assets/ is
 * ES5 served raw to the browser and this is ESM on the Workers runtime — so
 * the two are written out separately, the way assets/app.js's story clock
 * restates tools/clock.mjs. **Change one, change the other**, and node
 * tools/validate.mjs fails the build when the two sets of ids stop agreeing
 * or when a place glyph turns up among the markers, so the promise is kept
 * by something other than memory.
 *
 * What this half is for is narrower than what that half does: the server
 * never draws a pin, it only decides whether the two strings a list is asking
 * to store are ones this site has ever heard of. A tone or a glyph that is
 * not in these arrays is dropped rather than corrected — a list whose pin
 * came out of a request somebody hand-wrote goes back to the default, which
 * is what an unset column already means.
 */

/* The eight a list may choose from, in the order the picker draws them.
   They are marks on a map and mean nothing beyond that, which is the point
   of them; assets/pins.js says which emoji each one is and why there are
   eight rather than the eighteen this started with. */
export const PIN_GLYPHS = [
  'pin', 'flag', 'flame', 'sun', 'heart', 'blossom', 'gem', 'balloon'
];

/* What an unset column means, said once. Stored as '' rather than as this,
   so that "never chose" and "chose the default" stay different rows and
   changing the default later is a change to this file rather than a write to
   everybody's lists.

   There is no colour beside it. Every marker draws in the style's accent —
   see MARKERS in assets/pins.js for why the six swatches went — so a list is
   one column and one decision. */
export const DEFAULT_PIN = 'pin';

/* One of the eight, or '' — which is what the column holds for a list
   nobody has dressed, and what the page reads as the default. Never throws
   and never corrects: a value this site does not know is a value it does not
   store, which covers a hand-written request, a glyph taken out of the table
   since, and the five kinds of place, none of which are anybody's to pick. */
export function cleanPin(value) {
  return typeof value === 'string' && PIN_GLYPHS.indexOf(value) >= 0 ? value : '';
}

/* --------------------------------------------------- the optional column
 *
 * lists.pin reaches a deployed database by hand — every statement in
 * db/schema.sql is CREATE TABLE IF NOT EXISTS, which adds no column to a
 * table that already exists, so it arrives by ALTER TABLE the way
 * users.about did. Which means a deploy can be live before somebody
 * has run it, and every read that wants it must not 500 in the meantime: a
 * list is a title and ten places, and the picture on its pin is not worth
 * the page.
 *
 * So the first read of an isolate asks for it, and what happens decides for
 * every read after it. One failed statement per isolate where the column is
 * missing, none where it is not, and no round trip either way — the same
 * shape wrongDatabase() in _lib.js uses to read the environment stamp once.
 *
 * Only "no such column" is taken as the answer. Any other failure is the
 * request having failed and is rethrown, because a database that is down
 * should look like a database that is down rather than like a list with a
 * plain pin.
 *
 * THE ANSWER OUTLIVES THE ALTER, AND THAT IS THE COST
 *
 * An isolate that has decided "no" holds that for its whole life. So running
 * the ALTER does not light the pins up everywhere at once: isolates that had
 * already answered go on drawing plain ones until they are recycled, which a
 * deploy does and idling does anyway — minutes, not an afternoon, and a
 * pressed swatch is dropped rather than lost, because the page sends it again
 * the next time it is pressed. Measured under `wrangler pages dev`: before
 * the ALTER every read and write answered 200 with an empty pin; after it,
 * the same isolate still did, and a restarted one stored and read it back.
 *
 * Run the line with the deploy, then, rather than after it. The alternative
 * is re-probing on a timer, which would buy a few minutes once and cost a
 * branch nobody could ever test.
 */
let columns = null;

export async function readingPins(env, make) {
  if (columns === false) return make(false);
  try {
    const out = await make(true);
    columns = true;
    return out;
  } catch (e) {
    if (!/no such column/i.test(String((e && e.message) || e))) throw e;
    columns = false;
    return make(false);
  }
}

/* The column as a piece of a SELECT list, or nothing at all — the half of
   readingPins() that every caller was spelling out for itself. Five
   statements across four files want it.

   `l.` is hardcoded because every one of those statements aliases lists as l,
   which is worth knowing before writing a sixth that does not. */
export const pinSelect = (pins) => (pins ? 'l.pin AS pin, ' : '');

/* The field as every reader hands it out: always there, always a string, ''
   where the row has nothing or the column is not there yet. The page turns
   '' into the default, once, in assets/pins.js — so the default lives in one
   place on each side rather than in every query. */
export function pinsOf(row) {
  return { pin: cleanPin(row && row.pin) };
}
