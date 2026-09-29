/* Tallinn Tastebuds — the six lists Google wrote, in the reader's language.
 *
 * window.TTBGoogleWords.list(list, t, lang) and .about(profile, t) put the
 * words of db/google-lists.sql into the language the page is read in.
 *
 * WHY IT EXISTS. Those lists are rows in D1 like anybody's, and everything in
 * a row is one string in one language: the title, the intro, the line under
 * each place and the account's profile line are English on every page, in a
 * site that is otherwise read in ten. Translating them in the database would
 * mean ten copies of every list, a `lang` column on `lists` and `list_items`,
 * and a generator that writes sixty rows a language. What the row holds is
 * fixed and generated — tools/googlelists.mjs writes exactly six titles, two
 * intros and one shape of line — so the browser translates it instead, out of
 * data/ui.json, the way it translates everything else it prints.
 *
 * WHAT IT KEYS ON. A list by its id, which is fixed for good (see LISTS in
 * tools/googlelists.mjs), and a line by the shape that tool writes: Google's
 * category, its rating and its count, taken apart and put back together in
 * the language's own word order. A line that does not have that shape — one
 * from any other list — is left alone. So is a category the file has no word
 * for, which stays Google's English; tools/validate.mjs holds the file to
 * every category the lists carry, so that is only a refresh that brought a
 * new one, and the page reads correctly until somebody adds it.
 *
 * WHAT IT DOES NOT DO. It never touches a list that is not one of the six, so
 * nobody's own title is looked up; and it does not fetch anything — `t` is
 * the page's own, which is why it is passed in rather than read from here.
 * It keeps each line it replaced on the item as `saidBy`, so a page that
 * changes language without reloading — the map's — can call it again and be
 * translated from Google's line rather than from its own last answer; the
 * titles and intros need no such copy, being looked up by id.
 *
 * KEEP IT IN STEP WITH tools/googlelists.mjs. The ids, the two intros' keys
 * and SAY below restate what that tool writes, and the validator fails the
 * build when they drift. A classic script that sets one global, for the
 * reason assets/pins.js gives; it is on every page that draws one of these
 * lists, before the page's own script.
 */
window.TTBGoogleWords = (function () {
  'use strict';

  /* The six lists and the ui.json key that holds each one's title. */
  var TITLES = {
    'top-ten-restaurants-by-google-pt7mwk': 'googleTitleRestaurants',
    'top-ten-bakeries-by-google-65nfrf': 'googleTitleBakeries',
    'top-ten-cafes-by-google-jz7c2b': 'googleTitleCafes',
    'top-ten-bars-by-google-8y6grz': 'googleTitleBars',
    'top-twenty-places-by-google-kwb7l5': 'googleTitleOverall',
    'top-ten-pizzerias-by-google-k83p93': 'googleTitlePizzerias'
  };
  var OVERALL = 'top-twenty-places-by-google-kwb7l5';

  /* "Bakery · 4.9 from 1,656 reviews on Google", as say() writes it. */
  var SAY = /^(.+) · (\d(?:\.\d)?) from ([\d,]+) reviews on Google$/;

  /* The account the six hang off, and the line its profile carries. */
  var ACCOUNT = 'google-statistics';

  function number(value, lang, digits) {
    try {
      return value.toLocaleString(lang, { minimumFractionDigits: digits, maximumFractionDigits: digits });
    } catch (e) {
      return String(value);
    }
  }

  /* Google's category in the language, or Google's own word when there is none.
     `t` answers a missing key with the key itself, which is how it is told. */
  function category(name, t) {
    var key = 'gcat' + name.replace(/[^A-Za-z]/g, '');
    var word = t(key);
    return word === key ? name : word;
  }

  function say(text, t, lang) {
    var m = SAY.exec(text);
    if (!m) return text;
    return t('googleSay', {
      category: category(m[1], t),
      rating: number(parseFloat(m[2]), lang, 1),
      count: number(parseInt(m[3].replace(/,/g, ''), 10), lang, 0)
    });
  }

  /* Translate one list in place — its title, its intro, and the line under
     each of its places. Anything else is returned untouched. */
  function list(l, t, lang) {
    if (!l || !TITLES[l.id]) return l;
    l.title = t(TITLES[l.id]);
    if (l.intro) l.intro = t(l.id === OVERALL ? 'googleIntroOverall' : 'googleIntro');
    (l.items || []).forEach(function (item) {
      if (typeof item.say !== 'string') return;
      if (item.saidBy === undefined) item.saidBy = item.say;
      item.say = say(item.saidBy, t, lang);
    });
    return l;
  }

  /* The same for a page of list rows — no places on them, so titles only. */
  function lists(rows, t, lang) {
    (rows || []).forEach(function (l) { list(l, t, lang); });
    return rows;
  }

  /* The account's profile line. */
  function about(profile, t) {
    if (!profile || profile.name !== ACCOUNT || !profile.about) return profile;
    profile.about = t('googleAbout');
    return profile;
  }

  return { list: list, lists: lists, about: about };
}());
