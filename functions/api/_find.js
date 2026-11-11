/**
 * Tallinn Tastebuds — one search of the city, for whoever asks.
 *
 * What GET /api/places?q= answers with: the roll ./places.js merges, searched
 * here, on the server, by the rules the map's find bar searches it by in the
 * browser. Written so that the iOS app, the lists picker and the blog editor
 * get the find bar's answer rather than a weaker one of their own, and so
 * that none of them has to download eleven hundred places to find one.
 *
 * WHY IT IS A COPY OF THE FIND BAR, AND WHICH HALF IS COPIED
 *
 * Until November 2026 `?q=` matched a name and then a street, from three
 * letters, in alphabetical order. The app's picker sent two letters and got
 * nothing, "pizza" found the places with pizza in the name, and the app's map
 * tab did not ask at all. The find bar meanwhile knew a place by its kinds
 * and its cuisines in eleven languages, by Google's category, by a word with
 * another ending and by a typing slip, and put the answers in the order of the week's ranking —
 * all in assets/app.js, where nothing else could reach it. A Function cannot
 * import from assets/, so the matching is written out here a second time,
 * function for function and under the same names less their prefix: fold(),
 * hasWords(), sameWord(), wordAs(), oneSlip(), wordAt(), tier() for findTier(), says() for
 * findSays(), score() for findScore(), and the order of findHits(). A change
 * to one is a change to both until the find bar asks this route instead of
 * searching its own copy, which is the change after this one.
 *
 * What is not copied is the reading of a sentence. "Pizza near me" is words
 * and a wish, and the wish is the chat's reader in assets/ask.js, in eleven
 * languages; a client that wants nearest first says so with `near`, and one
 * that wants a part of the map says `bbox`. This file takes words.
 *
 * WHY IT SEARCHES MEMORY AND NOT THE DATABASE
 *
 * The other shape was a table of words in D1 and a range read per search. It
 * was costed and left: the roll is already in the isolate for five minutes
 * (ROLL_TTL in ./places.js), so a search here reads no rows at all, where a
 * word index read between a hundred and fourteen hundred per search —
 * "restaurant" lands on two places in three — and a loop of made-up words
 * would have spent the day's reads the way the uncached roll once could. A
 * table would also have needed three writers kept in step with it, a load of
 * seven thousand rows by hand, and a prefix index forgives neither an
 * ending nor a slip. Eleven hundred haystacks are folded once per roll and a search
 * is a pass over them: well under a millisecond. The day the city is fifty
 * thousand rows this is the file to rewrite, and its callers need not know.
 */

/* Lowercased, the accents off, and the three letters decomposition leaves
   alone mapped by hand — fold() in assets/app.js, to the letter, because a
   word folded one way here and another there is a place found on the site
   and not in the app. */
function fold(value) {
  return String(value == null ? '' : value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[ıİ]/g, 'i')
    .replace(/ø/g, 'o')
    .replace(/ß/g, 'ss');
}

/* Where one word ends and the next begins, in a haystack. */
const EDGES = /[\s\/,.;:()&'"’+-]+/;
const EDGE = /[\s\/,.;:()&'"’+-]/;

/* Whether two words are one keystroke apart: a letter inserted, dropped or
   changed, or two neighbours swapped. */
function oneSlip(a, b) {
  const la = a.length;
  const lb = b.length;
  if (a === b || Math.abs(la - lb) > 1 || lb < 4) return false;
  let i = 0;
  while (i < la && i < lb && a[i] === b[i]) i++;
  let ja = la - 1;
  let jb = lb - 1;
  while (ja >= i && jb >= i && a[ja] === b[jb]) { ja--; jb--; }
  if (la === lb) {
    if (ja === i) return true;
    return ja === i + 1 && a[i] === b[ja] && a[ja] === b[i];
  }
  return ja < i + 1 && jb < i + 1;
}

/* Whether `h`, a whole word of a haystack, is `word` with another ending:
   its last one or two letters taken off, four left at the least — "kohvikus"
   is kohvik, "burgers" burger — or swapped for as many — "пиццу" is пицца.
   It was any four letters two words shared, anywhere in either, until
   November 2026, and "pasta" was the pastry shops and "store" every
   restoran in town; sameWord() in assets/app.js has the count. */
function sameWord(word, h) {
  const keep = Math.max(4, word.length - 2);
  if (h.length < keep || h.length > word.length) return false;
  return h.length < word.length ? word.startsWith(h) : h.slice(0, keep) === word.slice(0, keep);
}

/* The whole word of a folded string that `word` is with another ending, or
   nothing. */
function wordAs(hay, word) {
  return hay.split(EDGES).find((h) => sameWord(word, h)) || '';
}

/* Three when every word is in the haystack as typed, two when any reached it
   only as a word of five letters or more with another ending, one when any
   reached it only by a slip against a whole word, nought when a word landed
   nowhere. */
function hasWords(entry, words) {
  let hit = 3;
  for (const word of words) {
    if (entry.hay.includes(word)) continue;
    if (word.length < 5) return 0;
    if (!entry.words) entry.words = entry.hay.split(EDGES);
    if (entry.words.some((h) => sameWord(word, h))) {
      hit = Math.min(hit, 2);
      continue;
    }
    if (!entry.words.some((w) => oneSlip(word, w))) return 0;
    hit = 1;
  }
  return hit;
}

/* Where one word falls in one folded string: 3 a whole word, give or take
   two letters of ending — none for a word of one or two letters; 2 the start
   of a longer word; 1 inside a word; 0 nowhere. */
function wordAt(hay, word) {
  let best = 0;
  let from = 0;
  let i;
  while (best < 3 && (i = hay.indexOf(word, from)) !== -1) {
    if (i === 0 || EDGE.test(hay[i - 1])) {
      const end = i + word.length;
      let j = end;
      while (j < hay.length && !EDGE.test(hay[j])) j++;
      best = Math.max(best, j - end <= (word.length < 3 ? 0 : 2) ? 3 : 2);
    } else {
      best = Math.max(best, 1);
    }
    from = i + 1;
  }
  return best;
}

/* How squarely the words landed, as good as the weakest of them: 3 at the
   start of a word of the name or a whole word of what the place is, 2 the
   start of a longer word of what it is from four letters typed, 1 inside a
   word of the name or at the start of a word of the street, 0 only ever
   brushing what it is or where. HOW SQUARELY THE WORDS LAND above findTier()
   in assets/app.js is the argument, with the places that made it. */
function tier(entry, words) {
  let low = 3;
  for (let word of words) {
    let n = wordAt(entry.name, word);
    let k = wordAt(entry.kind, word);
    let w = wordAt(entry.where, word);
    if (!n && !k && !w && word.length >= 5) {
      word = wordAs(entry.name, word) || wordAs(entry.kind, word) || wordAs(entry.where, word) || word;
      n = wordAt(entry.name, word);
      k = wordAt(entry.kind, word);
      w = wordAt(entry.where, word);
    }
    let got;
    if (n >= 2 || k === 3) got = 3;
    else if (k === 2 && word.length >= 4) got = 2;
    else if (n === 1 || w >= 2) got = 1;
    else if (k || w) got = 0;
    else got = 1;
    low = Math.min(low, got);
    if (!low) break;
  }
  return low;
}

/* 1 when every word starts a word of the name, of Google's category for the
   place or of what data/serves.json says it serves — it says it is a coffee
   shop, or somebody who ate there says so — and 0 when it is only filed
   beside one. */
function says(entry, words) {
  return words.every((word) => wordAt(entry.name, word) >= 2 || wordAt(entry.category, word) >= 2) ? 1 : 0;
}

/* Google's score for ordering and nothing else, as if PRIOR more people had
   reviewed the place and given the city's average; -1 with no score. */
const PRIOR = 50;
const MEAN = 4.4;
function score(row) {
  if (typeof row.rating !== 'number') return -1;
  const n = typeof row.reviews === 'number' ? row.reviews : 0;
  return (n * row.rating + PRIOR * MEAN) / (n + PRIOR);
}

/* Metres between two points, near enough at this latitude for an order. */
function metres(a, b) {
  const rad = Math.PI / 180;
  const x = (b.lng - a.lng) * rad * Math.cos(((a.lat + b.lat) / 2) * rad);
  const y = (b.lat - a.lat) * rad;
  return Math.round(Math.sqrt(x * x + y * y) * 6371000);
}

/* Every label one entry of a translated list carries, in one string: a
   type's out of data/taxonomy.json, its `words` among them, or a cuisine's
   out of data/cuisines.json. */
function labels(list, id) {
  const entry = list.find((item) => item.id === id);
  if (!entry) return '';
  return Object.keys(entry)
    .filter((key) => key !== 'id' && typeof entry[key] === 'string')
    .map((key) => entry[key])
    .join(' ');
}

/**
 * The roll as something to search: one entry per row, folded once.
 *
 * `types` and `cuisines` are the two translated lists; `mine` is
 * data/map.json by id, for what only the map knows about a place of mine —
 * its kinds, its dishes and whether it has shut. Any of the three may be
 * empty, and the search is then by name, street and Google's category.
 *
 * A Google row is what it is called, where it is, and what it is: Google's
 * category and its tags, the map's words for it less `pub` — which
 * VENUE_TYPES in ./_lib.js hands any place with a drinks licence — and the
 * directory's kitchens. A place of mine is found by its name, street, kinds,
 * dishes and the kitchens and tags its linked Google row lends it, and
 * ranked by the first four. What data/serves.json says either serves is
 * part of what it is, for the finding and the ranking both:
 * what I filed a place under outranks what Google calls it.
 */
export function findIndex(roll, types, cuisines, mine) {
  const kitchen = (id) => labels(cuisines, id) || labels(types, id);
  /* Less the rows Google calls temporarily closed, which the roll carries for
     the map's find bar alone — WHAT A SHUT ROW IS FOR in ./places.js. A place
     of mine never carries `closed` on the roll; its own comes off `mine`. */
  return roll.filter((row) => !row.closed).map((row) => {
    const own = mine.get(row.id);
    const name = fold(row.name);
    const where = fold(row.address || '');
    const tags = fold((row.tags || []).join(' '));
    const serves = (row.serves || []).join(' ');
    const lent = fold((row.kitchens || []).map(kitchen).join(' '));
    let kind;
    let hay;
    if (row.map && !row.google) {
      kind = fold([
        ((own && own.types) || []).map((id) => labels(types, id)).join(' '),
        ((own && own.mustOrder) || []).join(' '),
        serves
      ].join(' '));
      hay = [name, where, kind, lent, tags].join(' ');
    } else {
      kind = fold([
        row.category || '',
        serves,
        (row.types || []).map((id) => (id === 'pub' ? '' : labels(types, id))).join(' ')
      ].join(' ')) + ' ' + tags + ' ' + lent;
      hay = name + ' ' + where + ' ' + kind;
    }
    return {
      row,
      mine: !!(row.map && !row.google),
      closed: !!(own && own.closed),
      name,
      where,
      kind,
      hay,
      category: fold([row.category || '', serves].join(' ')),
      words: null
    };
  });
}

/* How many of my own places open an answer ahead of the city's order. */
const MINE_FIRST = 3;

/**
 * The rows `typed` reaches, best first, at most `limit` of them.
 *
 * `near` is a point to measure from: every row then carries `distance` in
 * metres, and the nearest come first among rows that landed equally well.
 * `box` is [south, west, north, east], and holds the search to it.
 *
 * The order is the find bar's. The words as typed before another ending
 * before a slip, and a slip only when nothing carried the words themselves; the
 * squarest landing first, and the rows the words only brushed dropped when
 * anything landed better; the places that say the word before the ones filed
 * beside it. Then up to three of my own places, best by Google's reviews, and
 * everything after them — mine included — by the week's rank.
 */
export function find(index, typed, { near, box, limit }) {
  const words = fold(typed).split(/\s+/).filter(Boolean).slice(0, 8);
  /* Two letters at least, whatever the alphabet: one is every place in town. */
  if (words.join('').length < 2) return [];

  let hits = [];
  for (const entry of index) {
    const row = entry.row;
    if (box && !(row.lat >= box[0] && row.lat <= box[2] && row.lng >= box[1] && row.lng <= box[3])) continue;
    const level = hasWords(entry, words);
    if (!level) continue;
    hits.push({
      entry,
      level,
      tier: tier(entry, words),
      says: says(entry, words),
      away: near && typeof row.lat === 'number' && typeof row.lng === 'number' ? metres(near, row) : Infinity
    });
  }

  if (hits.some((hit) => hit.level === 3)) hits = hits.filter((hit) => hit.level > 1);
  if (hits.some((hit) => hit.tier > 0)) hits = hits.filter((hit) => hit.tier > 0);

  const landed = (a, b) => b.level - a.level || b.tier - a.tier || b.says - a.says || a.away - b.away;
  const rank = (hit) => (typeof hit.entry.row.rank === 'number' ? hit.entry.row.rank : Infinity);

  /* Shut is not somewhere to send anybody first, so a closed place of mine is
     never one of the three; it stays in the answer, saying so, because a list
     may still want it. */
  const mine = hits
    .filter((hit) => hit.entry.mine && !hit.entry.closed)
    .sort((a, b) => landed(a, b) || score(b.entry.row) - score(a.entry.row));
  const first = mine.slice(0, MINE_FIRST);
  const rest = hits.filter((hit) => !first.includes(hit));

  /* With no Google row that is the kind typed, the words are a name, and a
     name that starts with them goes ahead of one that only holds them. */
  const q = words.join(' ');
  const named = !rest.some((hit) => !hit.entry.mine && hasWords({ hay: hit.entry.kind }, words) === 3);
  const starts = (hit) => (named && hit.entry.name.startsWith(q) ? 0 : 1);
  rest.sort((a, b) =>
    landed(a, b) ||
    starts(a) - starts(b) ||
    (rank(a) === rank(b) ? 0 : rank(a) - rank(b)) ||
    score(b.entry.row) - score(a.entry.row) ||
    (a.entry.name < b.entry.name ? -1 : 1));

  return first.concat(rest).slice(0, limit).map((hit) => ({
    ...hit.entry.row,
    ...(hit.entry.closed ? { closed: true } : {}),
    ...(hit.away !== Infinity ? { distance: hit.away } : {})
  }));
}
