/**
 * Tallinn Tastebuds — /flashcard.html, and flashcard.tallinntastebuds.ee.
 *
 * WHAT THIS PAGE IS
 *
 * A site about eating in Tallinn is read mostly by people who cannot read the
 * menu. This is the other half of that: fifty-two decks of Estonian, two
 * thousand four hundred and eighty-two cards, Estonian on the front and what it
 * means on the back, and one card at a time with two words under it — Knew
 * it, and Show me again. Over the card, how the sitting is going; under it,
 * on the face that asks, the first letters of the answer for anybody who
 * wants them.
 *
 * THE BACK IS IN THE LANGUAGE THE PAGE IS BEING READ IN
 *
 * The decks the site ships say what a card means in three: English,
 * Azerbaijani and Russian. Which one a card is turned over into is not a choice
 * anybody makes here — it is whichever of those three this page is being read
 * in, out of ?lang=, ttb.lang or the browser's own languages, and English for
 * anybody who asked for one of the site's other seven. means() below is the
 * whole of it, and the reason it is one function is that a deck somebody wrote
 * has one side in one language and nothing to pick.
 *
 * THREE, WHERE EVERY OTHER PAGE HAS TEN
 *
 * This is the one page on the site that speaks fewer languages than the site
 * does, switch and all, and the header of DECK_LANGS in
 * functions/api/_lib.js is the whole of why: the back of a flashcard is the
 * lesson rather than the chrome around it, and a Finnish door around one
 * thousand nine hundred and sixty English answers is a promise the cards
 * cannot keep.
 * Nothing on this side knows the list — the route narrows it and sends what is
 * left, the same way it settles which of them this is being read in.
 *
 * Learning Estonian through an English you are shaky in is two languages'
 * work, and the people this site is written for are the ones it was hardest
 * on. See **Flashcards** in README.md.
 *
 * It is on its own hostname for the reason splitwise is: it is not the map,
 * and a sixth card on the account page reading "Flashcards" would have been a
 * second product filed under somebody's saved places.
 * functions/_middleware.js is what makes the subdomain the front door to this
 * page and sends every other address on it back to the map; the page itself
 * answers at /flashcard on every host, including the previews under
 * *.tallinntastebuds.pages.dev where a subdomain of the live domain cannot
 * exist at all.
 *
 * functions/flashcard.js serves the document, the way functions/split.js
 * serves that one — and for a different reason. A group's link is pasted into
 * a chat, so that head carries the group's name. Nothing here is ever sent to
 * anybody: what that route is for is the decks the site ships being
 * indexed, so it writes the deck's own head and its words into the page as
 * text. Nothing here depends on that having happened — every answer this page
 * draws it fetches for itself, the route is an improvement on the load rather
 * than a requirement for it, and the <main> it writes into is emptied by
 * render() before anything is drawn.
 *
 * AND THE GRAMMAR, WHICH IS READ RATHER THAN TURNED OVER
 *
 * Four lessons sit on the shelf under a heading of their own, after the first
 * stage: why a noun has three forms and the fourteen cases they open, and why
 * a verb does and every tense it grows into. Under them, a second heading
 * teaches the cases one at a time — five short lessons, each followed by a
 * deck of cards that uses only what it taught, and Got it on one of those goes
 * on into its deck rather than back to the shelf. A lesson is a tile
 * like a deck's and opens at the same kind of address, and what it opens to is
 * prose — paragraphs, small headings, a paradigm or two and the sentences that
 * use them — with one filled action at its foot, Got it, which marks it read and goes back to the shelf.
 * The mark is a known row under the deck id GRAMMAR below, written by the
 * same action a card is and kept in this tab the same way when there is no
 * account to write it to. lessonCard() is the whole of the drawing, and
 * **Grammar, which is read rather than turned over** under **Flashcards** in
 * README.md is the reasoning.
 *
 * AND THE SONGS, WHICH ARE LISTENED TO
 *
 * After the grammar, a heading of songs: a tile for each, and the deck of its
 * words beside it as an ordinary row. A song opens to the video and the song
 * line by line, what each line means under it and every word in it a press
 * that opens a box saying what that word means there. Heard it at the foot is
 * Got it again, under the deck id SONGS. songCard() is the drawing, and
 * **Songs, which are listened to** under **Flashcards** in README.md is the
 * reasoning.
 *
 * WHERE YOU LEFT OFF
 *
 * The front door reopens what this device had open — the deck a run was going
 * in, or the lesson being read, or the song — rather than the shelf, for somebody signed
 * in. rememberHere() below writes it and boot() reads it; **Where you left
 * off** under **Flashcards** in README.md says why it is the device's and not
 * the account's.
 *
 * HOW ANYBODY FINDS IT, WHICH IS ONE PILL
 *
 * A pill on the map's rail, third down, open to anybody who loads the map.
 * There was a row on /account.html too, behind a sign-in, and it was the
 * older of the two — the only door for a while, which meant a stranger on
 * the map never learnt the decks existed at all. The pill fixed that and the
 * row went after it: one door on the thing everybody opens first beats a
 * second one you have to sign in to reach, and the account page is shorter
 * for it. flash_open_rail is what the pill reports. See **How it is found**
 * under **Flashcards** in README.md.
 *
 * Unlinked is not hidden, though: the decks are in sitemap.xml and indexed,
 * which is the blog's arrangement rather than the split page's. See
 * **Flashcards** in README.md.
 *
 * SIGNED OUT, EVERY DECK STILL WORKS
 *
 * The decks the site ships are data/decks.json, and a file has nobody to
 * check. What an account buys is that pressing Knew it is remembered — on the
 * account rather than on the device, so the deck you got half through on a
 * phone is half through on a laptop. Signed out the run still runs, and it is
 * kept in this tab and nowhere else.
 *
 * SO FIVE WORDS ARE FREE AND THE REST OF A DECK IS NOT
 *
 * Signed out, a deck is opened, its first FREE_WORDS cards are turned over and
 * answered the way every card is, and then gateCard() below stands where the
 * next card would have been, until there is an account. It has no way past.
 *
 * That took three goes to arrive at and the two it replaced are worth knowing,
 * because each was a reasonable answer to a different question. The offer
 * stood only at the end of a run, on the reasoning that nobody should have to
 * make an account to find out whether a thing is worth one. Then it stood in
 * front of the deck, which put a form between somebody and a thing they had
 * not seen — dull, and the sensible thing to do with it is to go round it.
 * Then it stood one word in with a way past, which read well and left the page
 * doing the thing it cannot do: handing out card after card with nowhere to
 * put the answers.
 *
 * Because that is what the gate is actually about, and it is not the account.
 * A deck of flashcards is not a list of words to read. It is the asking again
 * tomorrow and again next week — BOXES in functions/api/flashcard.js is the
 * whole feature — and that needs a row per card per person. A run with nobody
 * to tell is the page pretending, and the person doing it finds out at the end
 * of the deck rather than at the start of it.
 *
 * Some words rather than none, because somebody shown nothing is being asked
 * to sign up for a description, and five to a tab rather than five a deck,
 * because five free words per deck across forty-two decks is the product. It
 * was one word until October 2026, and one word was a card and then a form —
 * FREE_WORDS says what that cost. They are the tab's words: the run below is
 * sessionStorage, so tomorrow is somebody arriving again, and nothing here
 * follows anybody who has not signed in.
 *
 * And making the account keeps the run that argued for it, which took a
 * mechanism rather than a promise: both ways of signing in leave the page, so
 * the answers are written down as they are given and posted by the load that
 * comes back with a session. keep() below is the whole of it, and it is what
 * lets the card in front say honestly that pressing past costs nothing.
 *
 * The one thing this page sends without an account is a card being reported
 * wrong — wrongLine() below, and the rule it breaks is stated where it is
 * broken, in the header of functions/api/flashcard.js. The Estonian here is
 * mine and no native speaker has read it; the people turning the cards over
 * are the only proofreaders it has, and an account in front of that is a
 * mistake nobody reports.
 *
 * THE SIGN-IN FORM IS HERE, AND IT IS THE THIRD COPY ON THE SITE
 *
 * Worth being plain about. There is one password form on this site, in
 * assets/app.js, inside the sheet the map opens; /account.html and
 * /lists.html both send people there with ?then= rather than growing a copy.
 * assets/split.js has the second, and its header argues the case: ?then= is
 * deliberately same-host, so sending somebody from a subdomain to the map to
 * sign in and back again is either an open redirect or a dead end.
 *
 * This is the same argument on a second subdomain, and a third copy of a form
 * is the point at which the argument stops being free. What makes it
 * survivable is the same thing that makes split.js's survivable: it is a copy
 * of the *form* and not of the *API*. It posts the same two fields to the
 * same /api/account with the same actions, reads the same errors out of the
 * same map, and prints the same strings out of data/ui.json — accountUsername,
 * accountPassword, accountNoReset, accountGoogle and the rest. Nothing about
 * accounts is decided here.
 *
 * If a fourth ever wants one, the answer is not a fourth copy: it is a shared
 * global beside assets/track.js — TTBAuth, drawing the form and owning the
 * three actions — and the three existing copies moved onto it. That is a
 * refactor of the sign-in on every page of this site and it is deliberately
 * not in the change that brought this page.
 *
 * ONE ADDRESS, AND IT IS A DECK
 *
 * ?d=<id> is the whole of the routing. Without it the page is the decks: the
 * ones the site ships that this person's stages have opened — nine of the
 * forty-two before anybody has answered a card — and yours under them. With it, it is that deck,
 * turning over. A deck somebody wrote has exactly one reader and it is its owner —
 * there is no share link here and holding an id buys nothing, which is the
 * one place this feature deliberately differs from lists and from splitwise.
 *
 * AND THE ADDRESS CHANGES WITHOUT THE DOCUMENT CHANGING
 *
 * Both of those addresses draw out of the same <main> — the decks, a deck, the
 * editor, the end of a run and the gate are five things render() decides
 * between, not five pages — so for a long time the only reason opening a deck
 * was a page load was that `asked` was read off the address once, at boot.
 * It cost the radio. A document that goes takes its <audio> with it, and the
 * one on this page is pressed by somebody settling in to learn Estonian for
 * twenty minutes: open a deck, back to the decks, open the next one, and the
 * music stopped on every one of those, since the tap that would have started
 * it again was itself the next navigation. Six decks in, the radio had spent
 * the sitting reconnecting, or been refused outright and waited behind a
 * button that said it was on.
 *
 * So the two addresses are taken in the page, which is what assets/blog.js
 * does between its index and a post, for the same reason and in the same
 * words. go() asks the route for the decks, or for one deck, puts the answer
 * where boot() puts it and pushes the address the link carried; the browser's
 * back button comes through popstate and takes the same road. The links keep their real hrefs, so a middle click
 * still opens a deck in a new tab and the page a search engine is served is
 * unchanged — see functions/flashcard.js, which writes the deck into the
 * markup. What is gained is that the <audio> element never goes, so the radio
 * plays across a whole sitting rather than across one deck.
 *
 * WHAT IT READS, WHICH IS ONE THING
 *
 *   /api/flashcard             the decks, how far you have got in each, and
 *                              every word on this page in the one language it
 *                              is being read in
 *   /api/flashcard?deck=       one deck, whole, with its cards, and the same
 *   /api/account               posted to, to sign in or create an account
 *   /api/say?text=             a card's Estonian aloud, only when a speaker
 *                              under the card is pressed — see sayLine()
 *
 * Most other pages fetch data/ui.json whole on the way in — ten languages of
 * every string the site has, 190 KB gzipped — to print their few dozen keys in
 * one of them; the map, the pass, the blog and the lists page read one
 * language's file out of data/lang/ instead, written by tools/languages.mjs.
 * Here the words ride in the same answer as the decks: the page
 * sends what it would have picked a language from, in order, and the route
 * answers with the language it settled on and that language's block, eight to
 * ten KB. One request before a card can be drawn rather than two, and a tenth
 * of the bytes. The header of functions/api/flashcard.js has the rest.
 */
(function () {
  'use strict';

  var ACCOUNT_API = '/api/account';
  var FLASH_API = '/api/flashcard';

  /* The same two keys the map writes and every other page reads. Walking from
     the map to here should not feel like leaving. */
  var STYLE_KEY = 'ttb.style';
  var LANG_KEY = 'ttb.lang';

  var STYLES = ['red', 'green', 'blue', 'plum'];
  var DEFAULT_STYLE = 'red';
  var DEFAULT_LANG = 'en';

  /* The server binds all three; the fields only stop somebody at the keystroke
     instead of at the round trip. MAX_NAME and MAX_SIDE in
     functions/api/flashcard.js are the ones that count — change one, change
     the other. */
  var MAX_NAME = 60;
  var MAX_SIDE = 60;

  var state = {
    ui: {},          // every word on this page, in `lang` and no other
    lang: DEFAULT_LANG,
    langs: [],       // { code, name } for each language the site speaks
    ready: false,    // whether the database is bound and this is its half
    google: false,   // whether Continue with Google is configured here
    user: null,
    decks: [],       // every deck: the shipped ones, then yours
    deck: null,      // the one that is open, whole, with its cards
    lessons: [],     // the grammar on the shelf: id, name, why, read
    lesson: null,    // the one being read, whole, with its body
    songs: [],       // the songs on the shelf: id, name, why, heard
    song: null,      // the one being listened to, whole, with its words
    run: null,       // the cards left to turn over, and where in them we are
    gated: false,    // whether the gate stands in place of the next card
    words: 0,        // how many shipped cards this person knows, all decks
    wordsIn: 0,      // the same number as the route last answered it
    gates: {},       // what each stage opens at, by level id, off the route
    locked: false,   // whether the open deck is in a stage not yet reached
    editing: false,  // a deck of your own, being written rather than turned
    editingCard: null, // the one row in the editor showing its fields open, or none
    view: 'in'       // which half of the sign-in form: 'in', 'up' or 'google'
  };

  /* Which deck the address is asking for. Read off the address on the way in
     and written by go() after that, because the address moves under this page
     now rather than taking the page with it. */
  var asked = new URLSearchParams(window.location.search).get('d') || '';

  /* And what /api/google says came of a round trip, read the same way. The
     five words are the ones in the header of functions/api/google.js; this
     page acts on four of them and lets 'linked' alone, because connecting is
     pressed on the account page and comes back there. */
  var googleSaid = new URLSearchParams(window.location.search).get('google') || '';

  /* Which of the two hostnames this is being read on, and what that changes.
     Same three lines assets/split.js carries, and the same reasoning: on the
     subdomain this page is the bare root and the map is one domain up. */
  var ON_SUBDOMAIN = window.location.hostname.indexOf('flashcard.') === 0;
  var HOME = ON_SUBDOMAIN ? '/' : '/flashcard';
  var MAP = ON_SUBDOMAIN ? 'https://tallinntastebuds.ee/' : '/';

  var main = null;

  /* One of this page's own addresses, carrying whatever ?style= and ?lang= the
     current one arrived with. This page is served from another origin — that
     is what a subdomain is — so the localStorage the map writes those two
     choices into is empty here and there is no swatch on this page to fill it.
     The query string is then the only thing carrying a choice, and dropping it
     on the first link would put somebody who asked for green and Estonian back
     on red and English before they had pressed anything. */
  function at(path) {
    var now = new URLSearchParams(window.location.search);
    var keep = new URLSearchParams();
    ['style', 'lang'].forEach(function (k) { if (now.get(k)) keep.set(k, now.get(k)); });
    var q = keep.toString();
    return q ? path + (path.indexOf('?') === -1 ? '?' : '&') + q : path;
  }

  function deckHref(id) {
    return at(HOME + '?d=' + encodeURIComponent(id));
  }

  /* ------------------------------------------------- the two addresses, here
   * Opening a deck and coming back out of it, without the document going with
   * them. The head of this file says what that is for; this is the whole of
   * how it works, and it is go(), settle() and the links go() is reached from.
   * Nothing else on this page navigates any more — the one thing that still
   * did was the password form, and authForm() says what that cost.
   */

  /* Which trip is the current one. A deck row is a link and a link is easy to
     press twice, and the back button can arrive while an answer is still in
     the air; the last address asked for is the one that wins, and an answer
     that is no longer about it is dropped where it lands. A lock would have
     been the other way round — it would have dropped the back button and left
     the address saying one thing and the page showing another. */
  var trip = 0;

  /* How far down the decks were scrolled when one of them was opened. Thirty-
     four decks is several screens on a phone, and the way back to them used to
     be a page load, where the browser put somebody back where they had been.
     A deck is one screen and gets no such treatment: opening one always starts
     at the top of it. */
  var deckScroll = 0;

  /* Ask the route for an address and become it. The same request boot() makes
     and the same handling afterwards — settle() is that handling, shared — so
     a deck opened from a link is a deck opened the way a deck is opened.

     `push` is false for the back button, which has already moved the address,
     and true for every press that means to. The scroll and the focus are what
     a document navigation would have done and no longer does: the top of the
     page, and the card in hand or <main> under it. */
  function go(id, push) {
    var mine = ++trip;
    if (!asked) deckScroll = window.pageYOffset || 0;

    /* The scroll the browser would put back on the back button is put back
       before the answer has landed, over a page that is still the deck, so it
       is turned off rather than raced with — and turned off here rather than
       as this file loads, so that a plain reload of the decks still lands
       where it was left. Nothing can go back until go() has pushed, so the
       first press is early enough. */
    try { window.history.scrollRestoration = 'manual'; } catch (e) { /* old browser */ }

    /* The answer Undo was holding goes now, before the walk, and not from
       render() once the next answer is in: settle() drops the run that holds
       it, so by then there was nothing left to send. Every walk out of a
       deck within a breath of answering — All the decks, the back button —
       lost the last card, a write never sent signed in and a word never kept
       signed out. Sent before the request, too, so the shelf it asks for has
       the answer in it as often as the two arrive in order. */
    flush();

    var query = new URLSearchParams();
    query.set('lang', state.lang);
    if (id) query.set('deck', id);

    ask(FLASH_API + '?' + query.toString()).then(function (answer) {
      if (mine !== trip) return;

      /* The site did not answer. The page stays where it is and says so in
         the language it is already reading in — which is the one thing a
         page load could not have done here: it would have left somebody on
         the browser's own error page, out of the deck and out of the tab's
         run with it. */
      if (answer.status === 0) { toast(t('flashErrGeneric')); return; }

      asked = id;
      if (push) {
        try {
          window.history.pushState(null, '', id ? deckHref(id) : at(HOME));
        } catch (e) { /* an old browser keeps the address; the page is right */ }
      }

      settle(answer.out);
      render();
      /* The focus first and the scroll after it: focusing an element scrolls
         it into view, and <main> is the whole page, so the other order threw
         the decks back to the top the moment they had been put back. */
      focusRun();
      window.scrollTo(0, id ? 0 : deckScroll);

      /* And the page view, which the tag used to count for us: every deck was
         a document and the tag counted every one. Nothing loads now, so it is
         reported the way assets/blog.js reports a walk between the index and
         a post, and titled the same way — render() has just put the deck's
         name in the tab. What stays as the server wrote it is the canonical
         and the og: tags, because the address a crawler or a chat window is
         served is always a fresh load of it, never this walk. */
      TTBTrack.view(document.title);
    });
  }

  /* An answer from /api/flashcard, become the page. Everything here happens on
     the way in as well, which is why it is a function: boot() calls it with
     the first answer once it has set the language and the words up, and go()
     calls it with every answer after that.

     Everything a deck was holding is dropped first. A run, a card open in the
     editor and a gate all belong to the deck that was open, and carrying any
     of them into the next one is how a page that never reloads goes wrong. */
  function settle(out) {
    state.ready = !!out.ready;
    state.google = !!out.google;
    state.user = out.user || null;
    state.decks = out.decks || [];
    state.deck = out.deck || null;
    state.lessons = out.lessons || [];
    state.lesson = out.lesson || null;
    state.songs = out.songs || [];
    state.song = out.song || null;
    state.words = state.wordsIn = out.words || 0;
    state.gates = out.gates || {};
    state.run = null;
    state.gated = false;
    state.locked = false;
    state.editing = false;
    state.editingCard = null;

    /* And whatever this tab answered before there was an account to put it
       on — see keep() above.
     *
       Signed in, the writes go out now, and the answer they belong to was
       fetched before them, so the deck in hand is told as well. Without that
       second half, signing in at the end of a run would build a run of the
       whole deck again out of an answer that predates the very writes this
       load just sent, which is the thing being fixed wearing a different hat.
     *
       Signed out there is nowhere to send them and this tab is the whole of
       the record, so they are read rather than sent — and the same second
       half applies, for a longer-standing version of the same bug. Every
       answer was already being written down here and none of it was ever
       read back: the run rebuilt itself from the server's answer, which knows
       nothing about somebody with no account, so a reload started the deck at
       the top with fifteen answers sitting in storage. Now it does not, and
       walking out of a deck and into it again keeps them too. */
    var sent = (state.user && state.ready) ? sendKept() : kept();

    if (state.deck) {
      state.deck.cards.forEach(function (c) {
        var was = sent[from(c) + '/' + c.id];
        if (!was) return;
        c.known = was.knew;
        c.due = !was.knew;
      });
      startRun(false);
      /* And whether this deck is in a stage this person has not reached,
         since it has no row on the decks page while it is and the only way
         here is its address: a link somebody sent, a search result, the back
         button, a bookmark from before the stage shut.
       *
         Only signed in. Somebody with an account is being paced, and this is
         the deck their own page is not offering them yet. A stranger is not:
         they have no count, the stages hold their list rather than their
         links — gateFor() says why — and the one route into this page from
         outside is a search result, so the first thing they are shown has to
         be the thing they came for. What stands in front of them is the
         five-word gate under mark(), which always did. */
      state.locked = !!(state.user && gateFor(state.deck.level));
    }

    /* And a lesson read or a song heard in this tab before there was an
       account: the same store, under the deck id the route files each under,
       read back on to its tile and on to the page itself. */
    state.lessons.forEach(function (l) { if (sent[GRAMMAR + '/' + l.id]) l.read = true; });
    if (state.lesson && sent[GRAMMAR + '/' + state.lesson.id]) state.lesson.read = true;
    state.songs.forEach(function (s) { if (sent[SONGS + '/' + s.id]) s.heard = true; });
    if (state.song && sent[SONGS + '/' + state.song.id]) state.song.heard = true;

    /* A deck of your own with nothing in it yet opens as the editor rather
       than as a deck. There is nothing to turn over, and anything else would
       be an empty card with a word on it telling somebody to go and find the
       way to fill it. */
    if (state.deck && state.deck.own && !state.deck.cards.length) state.editing = true;

    /* Which deck, lesson or song is open, for the site's own count — WHAT IT
       WAS ABOUT in functions/api/_visitors.js. Once a load, however many
       answers come back for it. A deck of somebody's own is theirs alone and
       is left out, and so is anything data/decks.json does not ship, which
       the route checks. */
    var open = state.deck || state.lesson || state.song;
    if (open && !open.own) TTBTrack.about('deck', open.id);

    /* And whether the gate is already up. Two cases, and mark() has the
       ordinary third.
     *
       The tab has answered its FREE_WORDS signed out already — `sent` is what
       it is holding, read above rather than posted — so they are spent, on
       this deck and on every other. Without this line the reload button, or
       the way back to the decks and in again, would be the way past the gate:
       the run rebuilds from the route's answer, which has no idea who this is,
       and the next card would be handed over for nothing. Five words are five
       words, not five a deck opened.
     *
       And Google has come back wanting a name. That round trip returns to the
       address it left from, so it lands on the deck, and the form that asks a
       new Google account for a name lives on this card and nowhere else here.
       Without this the page would draw a card and the name would never be
       asked for, which is a dead end rather than a gate.
     *
       Both only where an account would work: with the database off there is
       nothing behind the form but a 503, nothing to sign in to, and nothing
       being kept from anybody — so the deck runs as it always did, which is
       the same rule authCard() is drawn under. */
    if (state.deck && !state.user && state.ready &&
        (state.view === 'google' || answered(sent) >= FREE_WORDS)) standGate();
  }

  /* A link to one of this page's two addresses, answered here rather than by
     the browser. The href stays exactly what it was, so a middle click, a
     ⌘-click and Open in new tab all still do what they say, and so does the
     page with no script behind it; what is taken is the plain left click,
     which is the one that would otherwise have taken the radio with it. */
  function inPage(node, id) {
    node.addEventListener('click', function (ev) {
      if (ev.defaultPrevented || ev.button || ev.metaKey ||
          ev.ctrlKey || ev.shiftKey || ev.altKey) return;
      ev.preventDefault();
      go(id, true);
    });
    return node;
  }

  /* --------------------------------------------------------------- helpers */

  function el(tag, props, kids) {
    var node = document.createElement(tag);
    if (props) {
      Object.keys(props).forEach(function (k) {
        var v = props[k];
        if (v === null || v === undefined || v === false) return;
        if (k === 'className') node.className = v;
        else if (k === 'textContent') node.textContent = v;
        else if (k === 'html') node.innerHTML = v;
        else node.setAttribute(k, v === true ? '' : String(v));
      });
    }
    (kids || []).forEach(function (kid) {
      if (kid === null || kid === undefined || kid === false) return;
      node.appendChild(typeof kid === 'string' ? document.createTextNode(kid) : kid);
    });
    return node;
  }

  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }

  var toastTimer = null;
  function toast(message) {
    var node = document.getElementById('toast');
    node.textContent = message;
    node.hidden = false;
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { node.hidden = true; }, 3800);
  }

  function storeGet(key) {
    try { return window.localStorage.getItem(key); } catch (e) { return null; }
  }

  /* Wrapped for the reason every touch of localStorage on this site is: it
     throws outright in some private-browsing modes, and the page is meant to
     work with it absent. A language that cannot be remembered is a language
     that has to be picked again next visit, which is a worse page and not a
     broken one. */
  function storeSet(key, value) {
    try { window.localStorage.setItem(key, value); } catch (e) { /* no store */ }
  }

  /* ------------------------------------------- what this tab is holding for you
   * Signed out, an answer has nobody to tell: the run is this tab's, it is
   * read back out of here on the next load, and the account is offered
   * FREE_WORDS words into the decks this tab opens and again at the end of a
   * run.
   *
   * What that cost until this existed was the run itself. The card says
   * "Remember where you got to", and both ways of taking it up leave the page
   * — the password form reloads, Continue with Google goes to Google and comes
   * back — so the twenty cards that were the evidence the offer was worth
   * taking had gone by the time it was taken. Somebody who signed in at the
   * end of a deck was put back at the start of it, having been promised the
   * opposite in the sentence they pressed.
   *
   * So an answer given with nobody to tell is written down here, and the next
   * load that has a session posts it. One mechanism covers both ways in, which
   * is the reason it is storage rather than something held in this page: the
   * Google trip leaves the origin, and nothing in memory survives that.
   *
   * sessionStorage and not localStorage, because the run is the tab's — that
   * is the README's own sentence for it — and a tab that is closed on a deck
   * rather than signed in has said what it wanted. It is keyed by deck and
   * card, so a word answered wrong and then right in the same run arrives as
   * the answer it ended on rather than as two writes racing.
   */
  var KEPT_KEY = 'ttb.flash.kept';

  /* The deck id a lesson read is filed under, in the tab's store here and in
     flashcard_known on the account: GRAMMAR_DECK in functions/api/flashcard.js,
     written out twice because neither dialect can import the other. */
  var GRAMMAR = 'grammar';

  /* And the one a song heard is filed under: SONG_DECK in the same route. */
  var SONGS = 'songs';

  /* How many words a tab may answer signed out before the gate goes up —
     see gateCard(). Five words to a tab, not five a deck.

     It was one. One word is a card turned and answered, and then a form: from
     1 to 5 October the gate stood 29 times and three accounts came out of the
     flashcards, and the page's views ended with nothing pressed three times in
     five. One card shows that the page has cards; it does not show what the
     page is for, which is a word you missed coming round again — and that
     only starts to happen a few cards in. Five is enough for a Show me again
     to be felt, and still a sample rather than a deck: the shortest deck the
     site ships is eighteen. keep() carries all five into the account, so the
     copy promises the words come along, not the word. */
  var FREE_WORDS = 5;

  /* How many cards the tab has answered, as opposed to lessons read or songs
     heard. The free words are spent by answers — see gateCard() — and reading
     or listening is not an answer, so neither done signed out brings the
     gate nearer. A card answered twice is one word. */
  function answered(sent) {
    return Object.keys(sent).filter(function (k) {
      return k.indexOf(GRAMMAR + '/') !== 0 && k.indexOf(SONGS + '/') !== 0;
    }).length;
  }

  /* Past this, the rest are answered again next time — the direction a failed
     write already errs in, and the harmless one.

     It is a cap on one case now, and it is worth saying which. Signed out with
     the database bound, the gate stops a tab at FREE_WORDS, so this holds
     five answers and never comes near the number. What fills it is the database
     being off: nothing is gated then, because there is nothing to sign in to,
     and nothing is sent either, so a tab can go through deck after deck. Two
     hundred is a little over three of the longest deck the site ships, which is
     the coffee shop at sixty-one.

     That number read thirty until this was rewritten, from back when the
     longest deck was thirty, which is what a count written into a comment does
     if nothing sends anybody back to it. */
  var MAX_KEPT = 200;

  function kept() {
    try {
      var was = JSON.parse(window.sessionStorage.getItem(KEPT_KEY) || 'null');
      return was && typeof was === 'object' ? was : {};
    } catch (e) { return {}; }
  }

  function keep(deck, card, knew) {
    var all = kept();
    var key = deck + '/' + card;
    if (!all[key] && Object.keys(all).length >= MAX_KEPT) return;
    all[key] = { deck: deck, card: card, knew: knew };
    try {
      window.sessionStorage.setItem(KEPT_KEY, JSON.stringify(all));
    } catch (e) { /* private browsing, or a full quota. The run is this page's,
                     which is where it stood before any of this. */ }
  }

  /* Everything the tab was holding, now that there is somewhere to put it.
     Cleared before the writes go out rather than after: a load that fails
     halfway should lose the rest rather than send them all again on the next
     one, which is the same harmless direction as above. What comes back is
     what went, because the answer this page booted from was fetched before
     any of it landed — see boot(). */
  function sendKept() {
    var all = kept();
    var keys = Object.keys(all);
    if (!keys.length) return all;
    try { window.sessionStorage.removeItem(KEPT_KEY); } catch (e) { /* nothing was stored */ }
    keys.forEach(function (k) {
      post(FLASH_API, { action: all[k].knew ? 'knew' : 'again', deck: all[k].deck, card: all[k].card });
    });
    return all;
  }

  function t(key, vars) {
    var s = state.ui[key];
    if (s === undefined) return key;
    if (vars) {
      Object.keys(vars).forEach(function (v) {
        s = s.split('{' + v + '}').join(String(vars[v]));
      });
    }
    return s;
  }

  /* What a deck is called, what the line under it says, what a card means and
     what its sentence means — in the language this page is being read in.
   *
     Two shapes arrive here and only one of them has anything to pick. A deck
     the site ships carries each of those as an object keyed by language:
     English, Azerbaijani and Russian today, and whichever the decks are
     written in next, with no code to change when they are — one line in
     DECK_LANGS in functions/api/_lib.js is the whole of adding a fourth. A
     deck somebody wrote carries a string per side, in whatever language they
     typed it in.

     `et` is never read out of one, even from a sentence that has one, and that
     is the one rule here worth stating: on this page Estonian is the thing
     being learnt rather than a language to learn it in, and sentence.et is the
     Estonian sentence itself. Somebody reading the map in Estonian gets the
     English back here, the way the other six the decks are not written in do.

     The route settles state.lang against DECK_LANGS now, so `et` cannot reach
     this line at all any more. It stays as the rail rather than the path: what
     it is guarding against is a card answering itself, and that is not a thing
     to leave to a list in another file. */
  function means(said) {
    if (typeof said === 'string') return said;
    if (!said) return '';
    var mine = state.lang === 'et' ? '' : said[state.lang];
    return mine || said[DEFAULT_LANG] || '';
  }

  /* Asked so that "the site did not answer" and "the site answered no" stay
     apart: the first is a network this page cannot fix and the second is a
     fact about the deployment or about the deck. Copied from
     assets/account.js, which says the same thing at more length. */
  function ask(url) {
    return fetch(url, { headers: { accept: 'application/json' } })
      .then(function (res) {
        return res.json().catch(function () { return {}; }).then(function (out) {
          return { status: res.status, ok: res.ok, out: out || {} };
        });
      })
      .catch(function () { return { status: 0, ok: false, out: {} }; });
  }

  /* `keepalive` is for the one write sent as the tab goes away — see flush() —
     which a plain fetch would have cancelled along with the page. */
  function post(url, payload, keepalive) {
    return fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: !!keepalive
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (out) {
        return { ok: res.ok, out: out || {} };
      });
    }).catch(function () { return { ok: false, out: {} }; });
  }

  /* One sentence per refusal either route can send back, and the general one
     for anything else: a visitor should never be shown a word out of the
     source. The account half is the same map assets/app.js keeps, because it
     is the same API answering. */
  var ERRORS = {
    /* the accounts route */
    taken: 'accountErrTaken',
    'no-match': 'accountErrNoMatch',
    password: 'accountErrPassword',
    username: 'accountErrUsername',
    'slow-down': 'accountErrSlow',
    'no-pending': 'accountErrGooglePending',
    linked: 'accountErrGoogleTaken',
    /* this one */
    'not-found': 'flashErrGone',
    'too-many': 'flashErrTooMany',
    often: 'flashErrOften',
    full: 'flashErrFull',
    name: 'flashErrName',
    front: 'flashErrFront',
    back: 'flashErrBack',
    'signed-out': 'accountErrSignedOut'
  };

  function say(out) {
    return t(ERRORS[out && out.error] || 'flashErrGeneric');
  }

  /* ------------------------------------------------------------------- boot
   * The style and the language, applied by the page itself before anything is
   * drawn. Every page on this site carries this block; see applyStyle() in
   * assets/lists.js, which is the fullest copy.
   */
  function applyStyle() {
    var fromUrl = new URLSearchParams(window.location.search).get('style');
    var stored = storeGet(STYLE_KEY);
    var style = STYLES.indexOf(fromUrl) !== -1 ? fromUrl
              : STYLES.indexOf(stored) !== -1 ? stored
              : DEFAULT_STYLE;

    document.documentElement.setAttribute('data-style', style);

    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      var wash = getComputedStyle(document.documentElement).getPropertyValue('--wash').trim();
      if (wash) meta.setAttribute('content', wash);
    }
  }

  /* What this page would pick a language from, in the order every other page
     picks: ?lang=, then the choice the map stored, then the browser's own. The
     picking itself is wordsFor() in functions/api/_lib.js, because the
     list to pick against is DECK_LANGS over there rather than anything on this
     side — so this is the candidates, sent as they are, and what comes back is
     whichever of the three the cards are written in it found first, or English.
     Anything past ten is noise the route would not read anyway. */
  function wanted() {
    var list = [new URLSearchParams(window.location.search).get('lang'), storeGet(LANG_KEY)]
      .concat(navigator.languages || [navigator.language || '']);
    var out = [];
    list.forEach(function (tag) {
      tag = String(tag || '').toLowerCase().split('-')[0];
      if (tag && out.indexOf(tag) === -1) out.push(tag);
    });
    return out.slice(0, 10);
  }

  function applyStaticStrings() {
    document.documentElement.lang = state.lang;

    var each = function (attr, apply) {
      var nodes = document.querySelectorAll('[' + attr + ']');
      for (var i = 0; i < nodes.length; i++) apply(nodes[i], nodes[i].getAttribute(attr));
    };
    each('data-i18n', function (n, k) { n.textContent = t(k); });
    each('data-i18n-aria-label', function (n, k) { n.setAttribute('aria-label', t(k)); });
    each('data-i18n-title', function (n, k) { n.setAttribute('title', t(k)); });
  }

  /* -------------------------------------------------------- the language bar
   * Every other page on this site reads its language off the map's own switch
   * and has none of its own. This one could not: on
   * flashcard.tallinntastebuds.ee the ttb.lang the map writes belongs to
   * another origin and is always empty here, so the back of a card was the
   * browser's languages or English, with nothing on the page to say otherwise.
   * Somebody reading Estonian through an English they are shaky in is the
   * person this page was written for, and they were the one with no way to ask
   * for Russian.
   *
   * So it is the map's switch, in this page's header: the code you are in, a
   * menu of the three under it, each with the name that language has for
   * itself — three rather than the map's ten, because the cards are written in
   * three and a switch is a promise about what pressing it does.
   * Every rule it is drawn with is already in assets/styles.css — #lang-switch,
   * .btn-lang-now, .lang-list — and the codes come down with the words, from
   * wordsFor() in functions/api/flashcard.js, so the page still fetches one
   * thing on the way in.
   *
   * PICKING ONE DOES NOT RELOAD THE PAGE, and that is the whole of why this
   * is thirty lines rather than one. A reload would throw away the run, which
   * signed out is kept in this tab and nowhere else — press Russian halfway
   * through a deck and the deck would start again. The cards, the deck names
   * and the sentences are objects keyed by language and are already here; the
   * only thing that is not is the block of words around them, so that is the
   * only thing fetched, and the page redraws in place the way the map does.
   */
  var langBar = null;

  /* Drawn by assets/language.js, which owns the trigger, the menu and the two
     document listeners that shut it; this page keeps the press — pickLanguage()
     — because only it knows how to ask its own route for the words. */
  function renderLanguageSwitch() {
    if (!langBar) return;
    window.TTBLanguage.mount(langBar, state.langs, state.lang, pickLanguage, t('language'));
  }

  function pickLanguage(code) {
    if (code === state.lang) return;
    TTBTrack.event('language_select', { language: code });

    /* Three things have to hear it and only one of them is this tab. The store
       is what the next visit reads, and on the subdomain it is the first thing
       this page has ever had to put there; the address is what at() carries on
       to every link the page draws, so a deck opened from here opens in the
       language it was opened from; and the route is where the words are. */
    storeSet(LANG_KEY, code);
    var params = new URLSearchParams(window.location.search);
    params.set('lang', code);
    try {
      window.history.replaceState(null, '', window.location.pathname + '?' + params.toString());
    } catch (e) { /* an old browser keeps the address, and the links their old lang */ }

    ask(FLASH_API + '?lang=' + encodeURIComponent(code)).then(function (answer) {
      /* The site did not answer, or answered with an empty block — which is
         what the route sends when it cannot read data/ui.json. Either way the
         page stays in the language it is in and says so in that language: the
         one thing it must not do is start printing its own keys because
         somebody pressed a language. The choice is still stored and still in
         the address, so the next load is in it. */
      var words = answer.out.ui;
      if (!words || !Object.keys(words).length) {
        toast(t('flashErrGeneric'));
        return;
      }
      state.lang = answer.out.lang || code;
      state.ui = words;
      if (answer.out.langs && answer.out.langs.length) state.langs = answer.out.langs;
      /* And the station changes under it, the way it does on the map:
         somebody who has just asked for Russian is reading in Russian and
         listening to Наше Радио, rather than to whatever the language before
         it was playing. After the words and before the redraw, so the station's
         name and the sentence on the button change in the same frame as the
         rest of the page. */
      window.TTBRadio.language(state.lang);
      applyStaticStrings();
      /* render() writes the deck's own name over this where one is open. */
      document.title = t('flashDocumentTitle');
      renderLanguageSwitch();
      render();
    });
  }

  /* ------------------------------------------------------------------ radio
   * The map's button, playing the map's station, on a page that has no rail
   * to hang it from: assets/radio.js holds the station list, the <audio> and
   * the switch, and draws nothing — the page hands over the button in its
   * header, the words to put on it and somewhere to send the news, and owns
   * only the one thing that file cannot say, which is a stream that would not
   * start in the language this page is being read in.
   *
   * Mounted once the words are in and not before. What the button carries is
   * radioPlay and radioStop, and a page mounting it with an empty block would
   * hand a screen reader the key instead of a sentence — the one thing this
   * page must never do. Those words ride in with the cards, so the wait is
   * that one request rather than a second, and a load the route cannot answer
   * at all leaves the button hidden along with everything else here.
   *
   * IT STARTS FROM SILENCE HERE, AND THAT IS THE HOSTNAME
   *
   * The radio walks from the map to a list because both are one origin and
   * sessionStorage is where it writes down what was playing. This page is that
   * origin at /flashcard and is a site of its own on
   * flashcard.tallinntastebuds.ee — the same line that leaves ttb.lang empty
   * there and is why this header has a language switch on it at all. So on the
   * subdomain a radio playing on the map does not arrive with the visitor, and
   * the press that starts one is made here. Nothing is done about that: a
   * subdomain is a different site to a browser, and the alternative is this
   * page asking the map what it was playing.
   */
  function mountRadio() {
    window.TTBRadio.mount({
      button: document.getElementById('btn-radio'),
      name: document.getElementById('radio-name'),
      lang: state.lang,
      t: t,
      onchange: function (what) {
        if (what === 'fail') toast(t('radioFail'));
      }
    });
  }

  /* ----------------------------------------------------------------- pieces */

  function card(kids) {
    return el('section', { className: 'card lists-card' }, kids);
  }

  function heading(said, level) {
    return el(level || 'h1', { className: 'lists-title', textContent: said });
  }

  function foot(kids) {
    return el('p', { className: 'lists-row lists-foot' }, kids);
  }

  /* A hint sits inside the label, for the reason accountField() in
     assets/app.js gives: it is then part of what a screen reader reads when
     the field takes focus, rather than something only a sighted visitor
     finds. */
  function field(id, labelKey, opts) {
    opts = opts || {};
    var kids = [
      el('span', { className: 'ac-label', textContent: t(labelKey) }),
      el('input', {
        id: id,
        type: opts.type || 'text',
        autocomplete: opts.autocomplete || 'off',
        autocapitalize: opts.autocapitalize || 'none',
        autocorrect: 'off',
        spellcheck: 'false',
        maxlength: opts.maxlength || null,
        placeholder: opts.placeholder || null
      })
    ];
    if (opts.hint) kids.push(el('span', { className: 'ac-hint', textContent: opts.hint }));
    return el('label', { className: opts.className ? 'ac-field ' + opts.className : 'ac-field' }, kids);
  }

  function value(form, id) {
    var node = form.querySelector('#' + id);
    return node ? node.value.trim() : '';
  }

  /* The one refusal line a form is allowed to be carrying, put above the
     fields rather than under the button — nobody looks under a button they
     have just pressed — and cleared on the way into the next try. */
  function complain(form, message) {
    var old = form.querySelector('.ac-err');
    if (old) old.parentNode.removeChild(old);
    form.insertBefore(el('p', { className: 'ac-err', role: 'alert', textContent: message }),
                      form.firstChild);
  }

  /* A button that goes busy while the write is in flight and comes back if it
     is refused. `form`, where there is one, is the form this button is the
     action of: wiring the press to the form's submit event rather than to the
     button is what makes Enter in a field do what the button does. */
  function actor(labelKey, className, run, form) {
    var btn = el('button', { type: form ? 'submit' : 'button', className: className, textContent: t(labelKey) });
    var press = function () {
      if (btn.disabled) return;
      btn.disabled = true;
      btn.textContent = t('accountWorking');
      run(function () {
        btn.disabled = false;
        btn.textContent = t(labelKey);
      });
    };
    if (form) form.addEventListener('submit', function (ev) { ev.preventDefault(); press(); });
    else btn.addEventListener('click', press);
    return btn;
  }

  /* Google's mark, four paths, drawn rather than fetched — the same block the
     map's sheet and the split page carry, for the reasons written out in full
     beside GOOGLE_MARK in assets/app.js. */
  var GOOGLE_MARK =
    '<svg viewBox="0 0 48 48" focusable="false">' +
    '<path fill="#4285F4" d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z"/>' +
    '<path fill="#34A853" d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z"/>' +
    '<path fill="#FBBC05" d="M11.69 28.18C11.25 26.86 11 25.45 11 24s.25-2.86.69-4.18v-5.7H4.34C2.85 17.09 2 20.45 2 24s.85 6.91 2.34 9.88l7.35-5.7z"/>' +
    '<path fill="#EA4335" d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z"/>' +
    '</svg>';

  /* This page as it stands, less the word from the last trip: a stale ?google=
     carried into the next one would report something that did not just happen.
     Everything else is kept, the deck above all, so a trip comes back to the
     deck somebody was turning over. */
  function hereWithoutGoogle() {
    var params = new URLSearchParams(window.location.search);
    params.delete('google');
    var query = params.toString();
    return window.location.pathname + (query ? '?' + query : '');
  }

  /* No ?client= on the way out, unlike the map's: the saves are the map's and
     this page has never had a device id to claim rows under. */
  function googleHref() {
    return '/api/google?then=' + encodeURIComponent(hereWithoutGoogle());
  }

  function googleGo() {
    return TTBTrack.click(
      el('a', { className: 'ac-google', href: googleHref() }, [
        el('span', { className: 'ac-google-mark', 'aria-hidden': 'true', html: GOOGLE_MARK }),
        el('span', { textContent: t('accountGoogle') })
      ]),
      'account_google', { via: 'flashcard' }
    );
  }

  /* ------------------------------------------------------------- signing in
   * Continue with Google, or two fields and a switch between making an
   * account and signing in to one — the same actions, the same fields and the
   * same strings as the map's sheet. See the header for why there is a third
   * copy of this form on the site, and what would end that.
   */
  function authForm(saying) {
    var creating = state.view === 'up';
    /* The third view, and the one nobody chooses: a Google account that has
       just proved itself and has no account here yet. Same form with the
       password half taken out. */
    var naming = state.view === 'google';
    var form = el('form', { className: 'ac-form' });

    if (naming) {
      form.appendChild(heading(t('accountGoogleName'), 'h2'));
      form.appendChild(el('p', { className: 'lists-say', textContent: t('accountGoogleNameWhy') }));
    } else {
      saying.forEach(function (node) { form.appendChild(node); });
    }

    /* Before the fields, the way the map's sheet draws it: the quick way
       first, then the rule, then the form for anybody who would rather not. */
    if (state.google && !naming) {
      form.appendChild(googleGo());
      form.appendChild(el('p', { className: 'ac-or' }, [
        el('span', { textContent: t('accountOr') })
      ]));
    }

    form.appendChild(field('fc-user', 'accountUsername', {
      autocomplete: 'username',
      maxlength: '24',
      hint: creating || naming ? t('accountUsernameHint') : ''
    }));
    if (!naming) {
      form.appendChild(field('fc-pass', 'accountPassword', {
        type: 'password',
        autocomplete: creating ? 'new-password' : 'current-password'
      }));
    }

    /* What happens if the password goes, said before the button rather than
       discovered afterwards. The same sentence the map's sheet leads with. */
    if (creating) {
      form.appendChild(el('p', { className: 'ac-warn', textContent: t('accountNoReset') }));
    }

    form.appendChild(actor(creating || naming ? 'accountCreate' : 'accountSignIn', 'go', function (done) {
      var pass = form.querySelector('#fc-pass');
      /* The try, the refusal and the account, as the map's sheet reports
         them, so SIGNING UP in functions/api/_visitors.js can say why people
         who pressed this did not come out of it with an account. There is no
         sheet here to count opening or shutting: the form is the page. */
      var view = naming ? 'google' : creating ? 'up' : 'in';
      TTBTrack.event('account_try_' + view);
      post(ACCOUNT_API, naming ? {
        action: 'google-name',
        username: value(form, 'fc-user')
      } : {
        action: creating ? 'create' : 'login',
        username: value(form, 'fc-user'),
        password: pass ? pass.value : ''
      }).then(function (a) {
        if (!a.ok) {
          done();
          TTBTrack.refused(a.out, view);
          complain(form, say(a.out));
          return;
        }
        TTBTrack.event(naming || creating ? 'account_create' : 'account_login',
                       { via: naming ? 'google' : 'flashcard' });
        TTBTrack.event('account_done_' + view);
        /* Straight back to the route rather than patching state: signing in
           changes every answer on this page, including how much of the deck on
           screen this browser is allowed to remember. go() asks it the same
           question the way in asks, so this is the whole answer again and not
           a patch — and the tab's kept answers go out with it, which is what
           this card was offered for.

           It used to be a reload, and on a phone that was the deck-switching
           bug wearing a different hat: the document went, the radio went with
           it, and Safari refused the rejoin, so somebody who signed in at the
           gate spent the rest of the sitting in silence behind a button that
           said the radio was on. Nothing loads now.

           The address drops ?google= on the way — a stale word from the last
           trip carried into the next one would report something that did not
           just happen — and keeps the deck, so this lands back on the card
           the gate went up in front of. */
        if (naming) {
          try {
            window.history.replaceState(null, '', hereWithoutGoogle());
          } catch (e) { /* an old browser keeps the parameter, which is harmless */ }
        }
        go(asked, false);
      });
    }, form));

    if (!naming) {
      var swap = el('button', {
        type: 'button',
        className: 'alt',
        textContent: t(creating ? 'accountSwitchSignIn' : 'accountSwitchCreate')
      });
      swap.addEventListener('click', function () {
        state.view = creating ? 'in' : 'up';
        TTBTrack.event('account_switch', { view: state.view, via: 'flashcard' });
        render();
      });
      form.appendChild(swap);
    }

    return form;
  }

  /* The offer, at the foot of the decks and at the end of a run. Never the
     first thing on the page and never in front of anything: the decks above it
     all work, and what this card is about is the one thing that does not, which
     is being remembered. */
  function authCard() {
    return card([authForm([
      el('p', { className: 'eyebrow', textContent: t('flashKeepEyebrow') }),
      heading(t('flashKeepTitle'), 'h2'),
      el('p', { className: 'lists-say', textContent: t('flashKeepWhy') })
    ])]);
  }

  /* The gate. FREE_WORDS cards are turned over and answered signed out, and
     then this stands where the next card would have been, until there is an
     account. See the header for the argument; this is the shape of it.
   *
     There is no way past, and that is the whole change from the card it grew
     out of, which had one. A deck of flashcards is not a list of words to read
     — it is the asking again tomorrow, and again next week, and a page that
     cannot remember which ones you knew cannot do the only thing it is for. So
     turning card after card with nowhere to put the answers is not a lighter
     version of this page. It is the page pretending, and the person doing it
     finds out at the end of the deck rather than at the start.
   *
     Five words rather than none, and that is deliberate: somebody who has been
     shown nothing is being asked to sign up for a description. The words are
     the sample, real cards answered in the real way, and keep() above has
     written those answers into the tab, so what is already done comes with
     them when they make the account. That last part is why the copy can promise
     it.
   *
     The way out of a deck is not on this card and does not need to be: All the
     decks stands in the head above, where it stands on every view of a deck,
     and the whole of the decks page is still open signed out. What is behind
     the gate is the sixth word a tab answers, not the site. */
  function gateCard() {
    return card([authForm([
      el('p', { className: 'eyebrow', textContent: t('flashKeepEyebrow') }),
      heading(t('flashFirstTitle')),
      el('p', { className: 'lists-say', textContent: t('flashFirstWhy') })
    ])]);
  }

  /* Putting it on screen: the press is reported, and the form opens on Create
     account rather than on Sign in — the header of gateCard() and boot() below
     each say why. Both places that raise the gate come through here, so the two
     things that go with raising it cannot drift apart. */
  function standGate() {
    state.gated = true;
    TTBTrack.event('flash_keep_ask', { deck_id: state.deck.id });
    if (state.view === 'in') state.view = 'up';
  }

  /* ---------------------------------------------------------- the stages
   * Two of the four levels are stages, and they open on how many words this
   * person knows: `gates` off the route says at what, `words` says how many,
   * and both are the route's to compute — the page prints them and never
   * decides them, so there is one copy of the numbers. A level `gates` does
   * not name is open to everybody, which is how First words and At a
   * restaurant are drawn with their rows at nought words.
   *
   * What a stage that has not opened looks like is its heading and one line
   * under it saying what opens it, and no rows: the route sends the decks of
   * an open stage and none of the others, so there is nothing here to draw
   * without a link and nothing to hide. It used to send all forty-two and
   * leave the page to draw the rest as rows that did not open, which read as
   * a page half greyed out and put a second copy of the rule on this side.
   *
   * This is the one question the page still asks of the numbers, and it asks
   * it twice: once per heading in shippedCard(), so that a shut stage says
   * what opens it, and once in settle(), for a deck reached by its address.
   *
   * With the database off nothing is held — there is no count to hold anybody
   * to, so the whole shelf is drawn out of the file the way it was before any
   * of this, which is the same condition a row draws its count under. And a
   * deck of your own and the two gathered decks — what you got wrong, and
   * what you know — are in no stage, which the route says by giving them no
   * level, so there is nothing here to look up for them.
   *
   * Signed out is nought words and so the two gated stages are shut, headings
   * and all, which is the one thing about the stages that changed after they
   * shipped: a stranger handed forty-two rows has nothing on the page telling
   * them where to start, and nine is where to start — the five of First words
   * and the four of At a restaurant, which has no gate.
   * What signed out is not held to is a deck reached by its address — see
   * settle() — because an arrival from a search result is not the list.
   */
  function gateFor(level) {
    if (!state.ready) return 0;
    var gate = state.gates[level] || 0;
    return gate > state.words ? gate : 0;
  }

  /* The stages the last run opened, if any: the ones whose gate the count
     passed since the route answered. The line on the end of a run. */
  function opened() {
    return LEVELS.filter(function (level) {
      var gate = state.gates[level.id] || 0;
      return gate > state.wordsIn && gate <= state.words;
    });
  }

  /* Where the next card would have been, for a deck opened in a stage this
     person has not reached: the number, how far off it is, and the head above
     it with All the decks on it — which is the whole of what this owes
     somebody, the same as the sign-in gate does. */
  function lockedCard() {
    var gate = gateFor(state.deck.level);
    /* Always found: a gate is only ever answered for a level in LEVELS. */
    var level = LEVELS.filter(function (l) { return l.id === state.deck.level; })[0];
    return card([
      el('p', { className: 'eyebrow', textContent: t(level.key) }),
      heading(t('flashLockedTitle', { n: gate })),
      el('p', { className: 'lists-say', textContent: t('flashLockedWhy', { known: state.words, left: gate - state.words }) })
    ]);
  }

  /* ------------------------------------------------------------- the decks */

  /* Two decks are gathered rather than stored — the words you missed, and the
     words you know — and everything the page says about a card in one of them
     names the deck the card is really from. gathered() is the one test for
     both, so the places that treat them alike cannot come to differ over
     which of the two they had in mind. */
  function gathered(deck) {
    return !!(deck && (deck.missed || deck.review));
  }

  /* Every deck has a name and a line under it, and two of them have neither
     in the data: the gathered decks are assembled per request and their
     words belong to the interface rather than to the content — so they are
     in data/ui.json, where every other word on this page is, in all ten that
     file speaks even though this page only ever prints three of them. The
     rest come out of data/decks.json in the three the decks are written in,
     which is what means() picks between. */
  function deckName(deck) {
    return deck.missed ? t('flashMissedName')
         : deck.review ? t('flashReviewName')
         : means(deck.name);
  }

  function deckWhy(deck) {
    return deck.missed ? t('flashMissedWhy')
         : deck.review ? t('flashReviewWhy')
         : (means(deck.why) || null);
  }

  /* A count with its figure set apart from the words around it, the same way
     learnedLine() sets the words known: split on the placeholder rather than
     printed through t()'s substitution, so the string stays one sentence in
     data/ui.json and a language that puts the number after the word gets it
     there. The figure is what a row is scanned for, so it is the one thing in
     the count that carries weight. */
  function figure(key, n, className) {
    var said = t(key).split('{n}');
    return el('span', { className: className }, [
      said[0] || '', el('b', { textContent: String(n) }), said.slice(1).join(String(n))
    ]);
  }

  /* How much of a deck is known, as a rule the width of the tile. The same
     track and fill the bar over a run is drawn with, so the page has one
     picture of "how far through" rather than two. It repeats the count beside
     it rather than replacing it — a length says nothing to somebody who
     cannot see it, and design rule 10 is about exactly that. */
  function meter(known, all) {
    var fill = el('span', { className: 'flash-fill' });
    fill.style.width = (all ? Math.round((known / all) * 100) : 0) + '%';
    return el('span', { className: 'flash-track', 'aria-hidden': 'true' }, [fill]);
  }

  function deckRow(deck) {
    /* One number at the foot of a tile, and which one depends on whether
       there is anything to do: "6 due" is a reason to open a deck, and
       "9 / 22" is a fact about one. Signed out neither applies and it is the
       size of the deck, which is the only thing true for everybody. */
    var tracked = !!(state.user && state.ready);
    var said = !tracked ? figure('flashCards', deck.cards, 'lists-count mono')
             : deck.due ? figure('flashDue', deck.due, 'lists-count mono is-due')
             : el('span', { className: 'lists-count mono',
                            textContent: t('flashKnownOf', { known: deck.known, n: deck.cards }) });

    var why = deckWhy(deck);
    var lifted = gathered(deck);

    /* The rule of how much is known sits at the foot of every tile a person
       has progress on. Not on the two gathered decks, which are made of
       progress rather than having any — "what you know" is every word known
       by definition, and a full bar there would say nothing. */
    var foot = el('span', { className: 'flash-meter' + (tracked && !deck.due ? ' is-rested' : '') }, [
      tracked && !lifted && deck.cards ? meter(deck.known || 0, deck.cards) : null,
      said
    ]);

    return el('li', { className: 'menu-item' }, [
      TTBTrack.click(
        inPage(el('a', { className: 'menu-row', href: deckHref(deck.id) }, [
          el('span', { className: 'menu-say' }, [
            el('span', { className: 'menu-name', textContent: deckName(deck) }),
            /* What the deck is, in the body face, because it is a sentence of
               prose — .flash-why in assets/flashcard.css carries the argument
               and the design rule behind it. */
            why ? el('span', { className: 'flash-why', textContent: why }) : null
          ]),
          el('span', { className: 'menu-go', 'aria-hidden': 'true',
                       html: '<svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg>' }),
          foot
        ]), deck.id),
        'flash_open', { deck_id: deck.id, own: deck.own ? 1 : 0 }
      )
    ]);
  }

  /* Where a deck stands, which is what the rows are put in the order of.
     Three rungs, and they are the three things a deck can be asking for:

       1  waiting, and started  cards are due and some have been got right —
                                this is picking up where you left off
       2  not started           nothing answered in it yet, so it is the new
                                thing rather than the unfinished one
       3  resting               everything known, which stays known

     An empty deck of your own is the middle rung rather than the bottom one.
     It has nothing to rest; it is a deck somebody made a minute ago and has
     not put a word in yet, and reading it as finished would file the one deck
     they are about to open under everything else. */
  function standing(deck) {
    if (!deck.cards) return 2;
    if (!deck.due) return 3;
    return deck.known ? 1 : 2;
  }

  /* Forty-two decks is a great many to leave in one order for ever, and the
     file's order is the order somebody meets them in rather than the order
     they are any use in: a deck you had been all the way through sat exactly
     where it always had, above every deck still waiting, for as long as the
     account lasted. So the rows go in the order of what each deck is asking
     for, and a finished one sinks.

     Nothing is pressed and nothing is stored. The two numbers this turns on —
     `due` and `known` — are already on every row the route answers, because
     they are what draws "6 due" against "22 / 22" at its foot. A press
     would have wanted somewhere to keep the answer, and it would have fought
     the deck itself besides: a card got wrong in a finished deck puts it back
     to waiting, and one put at the bottom by hand would still be at the
     bottom then. Sinking by what is due rises again on its own.

     Sorted and not filtered. Every deck is still a row, still opens, and still
     offers Go through it anyway — a deck somebody wants to sit and read is not
     to be hidden because they already know it. And stable, so
     inside a rung the order is the one it arrived in: the file's for the decks
     the site ships, most-recently-edited-first for the ones somebody wrote.

     Signed out, and with the database off, there is nothing to sort by. Every
     row says how many cards it holds, none of them says what is due, and the
     order stays the file's — the same line deckRow() draws its count under. */
  function deckList(decks, asIs, className) {
    var ul = el('ul', { className: 'menu flash-shelf' + (className ? ' ' + className : '') });
    var order = (state.user && state.ready && !asIs)
      ? decks.slice().sort(function (a, b) { return standing(a) - standing(b); })
      : decks;
    order.forEach(function (deck) { ul.appendChild(deckRow(deck)); });
    return ul;
  }

  /* A lesson's tile: the same tile a deck gets, with one word at its foot
     saying whether it has been read. No rule and no count — there is nothing
     to be part-way through — and it never sinks: standing() sorts by what a
     deck is asking for, and a lesson asks for nothing but a read. */
  function lessonRow(lesson) {
    var said = el('span', { className: 'lists-count mono' + (lesson.read ? ' is-read' : ''),
                            textContent: t(lesson.read ? 'flashRead' : 'flashUnread') });
    return el('li', { className: 'menu-item' }, [
      TTBTrack.click(
        inPage(el('a', { className: 'menu-row', href: deckHref(lesson.id) }, [
          el('span', { className: 'menu-say' }, [
            el('span', { className: 'menu-name', textContent: means(lesson.name) }),
            lesson.why ? el('span', { className: 'flash-why', textContent: means(lesson.why) }) : null
          ]),
          el('span', { className: 'menu-go', 'aria-hidden': 'true',
                       html: '<svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg>' }),
          el('span', { className: 'flash-meter' }, [said])
        ]), lesson.id),
        'flash_lesson_open', { lesson_id: lesson.id }
      )
    ]);
  }

  function lessonList(lessons) {
    var ul = el('ul', { className: 'menu flash-shelf' });
    lessons.forEach(function (lesson) { ul.appendChild(lessonRow(lesson)); });
    return ul;
  }

  /* A song's tile is a lesson's, saying Heard or Not heard yet at its foot. */
  function songRow(song) {
    var said = el('span', { className: 'lists-count mono' + (song.heard ? ' is-read' : ''),
                            textContent: t(song.heard ? 'flashHeard' : 'flashUnheard') });
    return el('li', { className: 'menu-item' }, [
      TTBTrack.click(
        inPage(el('a', { className: 'menu-row', href: deckHref(song.id) }, [
          el('span', { className: 'menu-say' }, [
            el('span', { className: 'menu-name', textContent: means(song.name) }),
            song.why ? el('span', { className: 'flash-why', textContent: means(song.why) }) : null
          ]),
          el('span', { className: 'menu-go', 'aria-hidden': 'true',
                       html: '<svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg>' }),
          el('span', { className: 'flash-meter' }, [said])
        ]), song.id),
        'flash_song_open', { song_id: song.id }
      )
    ]);
  }

  /* The count itself, with the number set apart from the words around it: it
     is the thing the eye is meant to land on, and a figure in the middle of a
     sentence at the sentence's own size is a figure nobody sees.
   *
     `state.words` is the number, which is the one the stages are held against
     — wordsKnown() in functions/api/flashcard.js, shipped decks only, kept in
     step by mark() as a run goes. There is no second count of the same thing
     on this page and there should not be: this line says out loud what the
     stages are already deciding on quietly, which is most of why it belongs
     here.
   *
     Split on the placeholder rather than printed through t()'s substitution,
     which is how listsBy on the lists page and the rate on a deal card both
     put something of their own inside a translated sentence. The sentence
     stays one string in data/ui.json, in all ten languages, so a language that
     puts the number somewhere else in the line gets it there. */
  function learnedLine() {
    var said = t('flashLearned').split('{n}');
    return el('p', { className: 'flash-learned' }, [
      said[0] || '',
      el('b', { textContent: String(state.words) }),
      said[1] || ''
    ]);
  }

  /* The levels, in the order somebody meets them, and the string that names
     each. A deck with no level falls to the end under no heading at all, which
     is where the gathered decks would go if they were not lifted out above.

     Four headings and three stages: At a restaurant is second in the order
     and has no gate, because it is what this site is about and the four decks
     under it are the reason somebody who came for the map is on this page at
     all. The route says so by having no GATES entry for it, so gateFor()
     answers nought and it is drawn with its rows for a stranger at nought
     words, the same as First words. */
  var LEVELS = [
    { id: 'start', key: 'flashLevelStart' },
    { id: 'eat', key: 'flashLevelEat' },
    { id: 'more', key: 'flashLevelMore' },
    { id: 'deep', key: 'flashLevelDeep' }
  ];

  /* Which stage the grammar heading follows on the shelf. After the first
     rather than at the top: a stranger's first tile stays Hello and goodbye,
     and the lessons are about the three forms the restaurant decks under
     them show on every card. The songs follow the grammar. */
  var LESSONS_AFTER = 'start';

  /* The level of the deck a song keeps its new words in. Not a stage: it is
     drawn under the Songs heading beside the song, and nothing holds it
     back, since the route has no gate for it. */
  var SONG_LEVEL = 'song';

  /* And the level of the deck a case lesson is followed by. Not a stage
     either: it is drawn under The cases, one by one, straight after the
     lesson that names it, so the shelf reads lesson, cards, lesson, cards. */
  var CASE_LEVEL = 'case';

  /* Whether a lesson is one of the cases taught one at a time — which is to
     say, whether it names the deck that follows it. */
  function followed(lesson) { return !!lesson.deck; }

  /* The decks the site ships, and the sentence saying what this page is for.
     The two gathered ones go at the top, above the headings, in the order the
     route sends them and not the order standing() would put them in: what
     somebody got wrong first, because it is the most useful thing on the page
     and the only part of it they did not choose, and under it what they know,
     to go back over whenever they like. Sorting them would put the second
     above the first whenever nothing had been got wrong, and a list of two
     that swaps itself is not worth reading. */
  function shippedCard() {
    var ours = state.decks.filter(function (d) { return !d.own && !gathered(d); });
    var lifted = state.decks.filter(gathered);

    var kids = [
      el('p', { className: 'eyebrow', textContent: t('flashEyebrow') }),
      heading(t('flashTitle')),
      el('p', { className: 'lists-say', textContent: t('flashWhat') }),
      /* And the one number that is about the person rather than about the
         decks: how many of the shipped words they know, over every deck.
         Forty-two rows each saying "9 / 22" is forty-two facts and no score,
         and this is the one that grows over a month — which is the thing that
         brings somebody back on a Tuesday.
       *
         It is `state.words`, which is to say the stages' own number said out
         loud rather than a second count of the same thing — the page was
         already deciding what opens on it and saying nothing about it. See
         gateFor() above and **How many words you know** in README.md.
       *
         Only signed in, only where there is a database to have counted it,
         and only past nought. A nought here would be the page telling a
         stranger they have failed at something they have not started, and a
         count of what is remembered is a promise on a deployment that is
         remembering nothing. It appears on the load after the first card is
         known and rises from there. */
      state.user && state.ready && state.words > 0 ? learnedLine() : null,
      /* Said once, quietly, and only where it is true: the database is not
         bound or this deployment is holding the other half's. Every deck below
         still turns over — they are a file — so this is a line rather than the
         page refusing to draw. */
      state.ready ? null : el('p', { className: 'lists-say', textContent: t('flashErrOff') })
    ];

    if (lifted.length) kids.push(deckList(lifted, true, 'flash-lifted'));

    if (!ours.length) {
      kids.push(el('p', { className: 'lists-none', textContent: t('flashNoneShipped') }));
      return card(kids);
    }

    /* Grouped by level, with the quiet heading the directory puts over a run
       of rows. Forty-two decks in one column was a list to scroll; four short
       under headings is a choice about where you are — and only the stages
       that have opened have rows under them at all. */
    LEVELS.forEach(function (level) {
      var these = ours.filter(function (d) { return d.level === level.id; });
      /* A stage that has not opened has no rows — the route sends none — and
         is drawn as its heading and one line saying what opens it and how far
         off that is. The heading stays because what is ahead has to be
         visible for the count to have something to be counted towards, and a
         stage that vanished until it opened would be a page that grew rows
         nobody asked for.
       *
         An open stage with nothing in it draws nothing at all, heading
         included. That is the older rule and it is about the file rather than
         about a person: the headings are for the decks, not the other way
         round. */
      var gate = gateFor(level.id);
      if (these.length || gate) {
        kids.push(el('h2', { className: 'lists-section', textContent: t(level.key) }));
        if (gate) {
          /* With the same rule a deck's tile wears under it, filled to how far
             the count has come towards the gate: the stage is somewhere to get
             to, and a length is how far off it is at a glance. The line beside
             it still says it in words. */
          kids.push(el('p', { className: 'flash-opens mono' }, [
            meter(state.words, gate),
            el('span', { textContent: t('flashOpens', { n: gate, left: gate - state.words }) })
          ]));
        }
        if (these.length) kids.push(deckList(these));
      }
      /* The grammar, under a heading of its own — LESSONS_AFTER says where.
         Every lesson, whatever the count: they are prose, and a file has
         nobody to hold back. */
      var grammar = state.lessons.filter(function (l) { return !followed(l); });
      if (level.id === LESSONS_AFTER && grammar.length) {
        kids.push(el('h2', { className: 'lists-section', textContent: t('flashGrammar') }));
        kids.push(lessonList(grammar));
      }
      /* And the cases, one at a time: a lesson, then the deck of cards that
         uses only what it taught, then the next lesson. The pairing is the
         lesson's own `deck` rather than anything in the ids, and nothing in
         it is held back — the decks have no stage, so the route always sends
         them. See **The cases, one at a time** in README.md. */
      var cases = state.lessons.filter(followed);
      if (level.id === LESSONS_AFTER && cases.length) {
        kids.push(el('h2', { className: 'lists-section', textContent: t('flashCases') }));
        var steps = el('ul', { className: 'menu flash-shelf' });
        cases.forEach(function (lesson) {
          steps.appendChild(lessonRow(lesson));
          var cards = ours.filter(function (d) { return d.id === lesson.deck; })[0];
          if (cards) steps.appendChild(deckRow(cards));
        });
        kids.push(steps);
      }
      /* And the songs under theirs, straight after: each song's tile, and
         the decks of their words as ordinary rows in the same list. */
      var sung = ours.filter(function (d) { return d.level === SONG_LEVEL; });
      if (level.id === LESSONS_AFTER && (state.songs.length || sung.length)) {
        kids.push(el('h2', { className: 'lists-section', textContent: t('flashSongs') }));
        var songs = el('ul', { className: 'menu flash-shelf' });
        /* One song, then its words, then the next song: a song and the deck
           of what it teaches read as a pair, and three songs then three
           decks made somebody match them up. The pair is the id's first
           word — naera-naera and naera-words — and a deck that matches no
           song goes after them all rather than being dropped. */
        var first = function (id) { return String(id).split('-')[0]; };
        var left = sung.slice();
        state.songs.forEach(function (song) {
          songs.appendChild(songRow(song));
          left = left.filter(function (deck) {
            if (first(deck.id) !== first(song.id)) return true;
            songs.appendChild(deckRow(deck));
            return false;
          });
        });
        left.forEach(function (deck) { songs.appendChild(deckRow(deck)); });
        kids.push(songs);
      }
    });

    var loose = ours.filter(function (d) {
      return d.level !== SONG_LEVEL && d.level !== CASE_LEVEL && !LEVELS.some(function (l) { return l.id === d.level; });
    });
    if (loose.length) kids.push(deckList(loose));

    return card(kids);
  }

  /* And the ones somebody wrote. Signed out this card is not drawn at all —
     the offer of an account is what stands in its place, and two cards both
     saying "you would need an account" is the page asking twice. */
  function yoursCard() {
    var mine = state.decks.filter(function (d) { return d.own; });

    return card([
      el('p', { className: 'eyebrow', textContent: t('flashYoursEyebrow') }),
      heading(t('flashYours'), 'h2'),
      mine.length
        ? deckList(mine)
        : el('p', { className: 'lists-none', textContent: t('flashYoursNone') }),
      newDeckForm()
    ]);
  }

  function newDeckForm() {
    var form = el('form', { className: 'ac-form' });
    form.appendChild(field('fc-newdeck', 'flashNewDeck', {
      maxlength: String(MAX_NAME),
      placeholder: t('flashNewDeckHint')
    }));
    form.appendChild(actor('flashMakeDeck', 'go', function (done) {
      var name = value(form, 'fc-newdeck');
      if (!name) { done(); complain(form, t('flashErrName')); return; }
      post(FLASH_API, { action: 'deck', name: name }).then(function (a) {
        if (!a.ok || !a.out.deck) { done(); complain(form, say(a.out)); return; }
        TTBTrack.event('flash_deck', { deck_id: a.out.deck.id });
        /* Straight into it, and into the half that writes rather than the half
           that turns cards over: a deck with nothing in it has nothing to turn
           and the next thing anybody wants is the first word. */
        go(a.out.deck.id, true);
      });
    }, form));
    return form;
  }

  /* ------------------------------------------------------- turning them over
   * A run is the cards of one deck in the order they will be shown, and where
   * in that order we are.
   *
   * What goes in it is what is **due**: everything never got right — never
   * answered, or sitting in box nought. A card known once stays known and is
   * not asked again unless asked for; knownOf() in functions/api/flashcard.js
   * decides, and this page is told per card and puts the due ones in.
   *
   * `all` is the way past it: Go through it again at the end of a run, and Go
   * through it anyway on a deck with nothing waiting, both build a run of the
   * whole deck — the ones not yet known first, then the ones that are — so
   * somebody who wants to go over what they already know can.
   *
   * Pressing Show me again still puts the card back on the end of the run, so
   * it comes round once more before the deck is finished — and, on the server,
   * drops it into box nought, due now, so it is in the next run from the
   * beginning too and in the deck of what you got wrong.
   *
   * `back` is which cards have had that second turn, because it is one turn
   * and not an unlimited supply. See mark().
   *
   * `said`, `knew` and `again` are the two tallies over the card: how the run
   * is going, where the bar over them says how far through it is. They count
   * **cards** rather than answers, which is the whole of what `said` is for —
   * a card got wrong and then known on its second turn moves from one tally
   * to the other rather than standing in both, and the two of them always add
   * up to the cards answered. See mark().
   *
   * `hint` is whether the card in hand has been given away a little. It
   * belongs to the run rather than to the card, because it is about the turn
   * somebody is taking rather than about the word: answering clears it, and a
   * card that comes round again at the end of a run arrives unhinted.
   */
  function startRun(all) {
    var cards = (state.deck && state.deck.cards) || [];
    /* A deck of your own arrives in the order you typed it — cardsOf() in
       functions/api/flashcard.js orders by created_at, because that is the
       order the editor below is supposed to show. A run is not the editor:
       the newest word always landing last would mean the word you just
       added is always the one you are least tested on, forever. So a run of
       your own deck sorts by id instead — minted at random and never
       changed by anything, including editing a card's words — which shuffles
       the deck exactly once, the moment the first two cards exist, and never
       again: the same id sorts the same way every time this runs. A deck the
       site ships keeps the file's own order, because that order is a
       progression somebody wrote on purpose and shuffling it would undo the
       one thing about it worth keeping. */
    if (state.deck && state.deck.own) {
      cards = cards.slice().sort(function (a, b) { return a.id < b.id ? -1 : a.id > b.id ? 1 : 0; });
    }
    var queue = [];
    /* `c.due !== false` and not `c.due`: a card that arrives without the field
       at all is due. That is the safe direction, because a card wrongly called
       due is a card asked twice, and a card wrongly called resting is a card
       that silently leaves the deck. */
    cards.forEach(function (c) { if ((all || c.due !== false) && !c.known) queue.push(c); });
    cards.forEach(function (c) { if ((all || c.due !== false) && c.known) queue.push(c); });
    state.run = { queue: queue, at: 0, turned: false, back: {}, said: {},
                  knew: 0, again: 0, hint: false };
  }

  /* Which deck a card is really from, which is only ever different in the
     two gathered decks: those are assembled out of rows belonging to other
     decks, and everything said about a card there — the write, and the note
     that it has had its second turn — has to name the deck it came from
     rather than the one it is being shown in. */
  function from(word) {
    return word.deck || state.deck.id;
  }

  function current() {
    var run = state.run;
    return run && run.at < run.queue.length ? run.queue[run.at] : null;
  }

  /* How many cards of the open deck this person knows. Read off the deck in
     hand rather than asked for: every press has already changed it here. */
  function knownCount() {
    return ((state.deck && state.deck.cards) || []).filter(function (c) { return c.known; }).length;
  }

  /* Knew it, and its opposite. Both change the card in hand before the write
     goes out and neither waits for it: this is pressed a hundred times in a
     sitting and a card that hung on the network each time would be unusable.
   *
     A write that fails is deliberately silent. What it costs is that the card
     comes round again next time — the harmless direction — and what a toast
     would cost is an interruption in the middle of the one thing this page is
     for.

     Signed out there is nobody to write to, so the answer is written down in
     the tab instead and posted by the load that comes back with a session —
     keep() above. The run is still this tab's; what changed is that making an
     account at the end of it no longer throws the tab away. */
  function mark(word, knew, how) {
    var run = state.run;
    var key = from(word) + '/' + word.id;

    /* Everything this answer is about to change, written down first so that
       Undo can put it all back — undo() below. The previous answer's write is
       sent now, because only one answer can be taken back at a time. */
    flush();
    var was = {
      word: word, knew: knew, known: word.known, words: state.words,
      at: run.at, turned: run.turned, hint: run.hint, length: run.queue.length,
      back: run.back[key], said: run.said[key], tallyKnew: run.knew, tallyAgain: run.again
    };

    /* The count the stages open on, kept in step with the answer so that the
       end of this run can say a stage has opened without asking the route
       again — see opened(). A shipped card newly known is one more, a known
       one got wrong is one fewer, and a deck of your own counts for nothing,
       the same as wordsKnown() in functions/api/flashcard.js. */
    if (!state.deck.own && knew !== !!word.known) state.words += knew ? 1 : -1;
    word.known = knew;
    /* `how` is the one thing worth knowing about the three ways of answering:
       whether anybody found the swipe, and whether anybody on a laptop found
       the arrows. A press, a swipe and an arrow key are the same answer and
       report the same event, with one parameter telling them apart. `face` is
       the same question about the front: a throw and an arrow can both answer
       a card nobody turned over, and this is how anybody will find out
       whether people do that. */
    TTBTrack.event(knew ? 'flash_knew' : 'flash_again', {
      deck_id: state.deck.id,
      how: how,
      face: state.run.turned ? 'back' : 'front',
      /* And whether the first letters had been asked for before this answer
         was given, which is the one question a hint raises: a Knew it after a
         hint is not quite a Knew it, and nothing else here can tell. The
         box is not touched by it — hintLine() says why the answer stays
         both people's to give — so this parameter is how anybody finds out
         whether that was the right call. */
      hint: state.run.hint ? 1 : 0
    });

    /* Held rather than sent, until the next answer or until the card in hand
       is no longer on screen — flush() says when. That is what makes Undo
       honest without a route of its own: an answer taken back was never
       written anywhere, so there is nothing on the server to unwind. */
    run.pending = { deck: from(word), card: word.id, knew: knew };
    run.last = was;

    /* Back on the end of the run, and once only.
     *
       It used to be every time, and a run of a deck somebody was struggling
       with then had no end: three cards answered wrong put three more on a
       queue that was already growing, the bar over the card filled towards a
       total that moved away from it, and the only way to leave was the way
       back to the decks. A second look is the point — it is the one the
       README promises — and a third in the same sitting is not learning, it is
       the page refusing to let go.

       Nothing is lost by stopping there. The card is in box nought on the
       server, so it is due at the top of the next run of this deck and it is
       in the deck of what you got wrong, which is where looking again
       belongs. */
    var again = key;
    if (!knew && !state.run.back[again]) {
      state.run.back[again] = true;
      state.run.queue.push(word);
    }

    /* The two tallies over the card, by card rather than by answer. A card
       answered a second time was already counted once — it is the one this
       run put back — so it moves across rather than adding to the pair, and
       Still learning falls by one as Know rises by one. */
    var said = state.run.said[again];
    if (said === 'knew') state.run.knew -= 1;
    else if (said === 'again') state.run.again -= 1;
    state.run.said[again] = knew ? 'knew' : 'again';
    if (knew) state.run.knew += 1;
    else state.run.again += 1;

    state.run.at += 1;
    state.run.turned = false;
    state.run.hint = false;

    /* And this is where the gate goes up, signed out: on the answer, in the
       place the next card would have been.
     *
       On the answer rather than on the turn, because the two words under a
       turned card are the question the page asked, and taking them away before
       they are pressed is asking something and then not listening. The word is
       finished, properly, and then the deck stops. See gateCard().
     *
       `current()` because a deck with nothing left has nothing to gate: the end
       of a run says its own thing and carries the same offer already. The
       answer just given is not in the tab yet — it waits on the next one for
       Undo, see flush() — so it is added to what the tab holds, unless the tab
       already holds it from the last time it came round. */
    var held = kept();
    if (!state.user && state.ready && current() &&
        answered(held) + (held[key] ? 0 : 1) >= FREE_WORDS) standGate();

    render();
    focusRun();
  }

  /* The one answer that has been given and not yet written, sent now.
   *
     An answer waits until the next one because Undo can take it back, and
     it is sent the moment Undo stops being on offer: the next card answered,
     the card in hand gone off the screen for any reason — the end of the run,
     the gate, the editor, the way back to the decks, all of which go through
     render() — and the tab going away, which is what `keepalive` is for.
     Signed out it is written down in the tab instead, the way every answer
     with nobody to tell is — keep() above. */
  function flush(leaving) {
    var run = state.run;
    var p = run && run.pending;
    if (!p) return;
    run.pending = null;
    run.last = null;
    if (state.user && state.ready) {
      post(FLASH_API, { action: p.knew ? 'knew' : 'again', deck: p.deck, card: p.card }, leaving);
    } else {
      keep(p.deck, p.card, p.knew);
    }
  }

  /* Undo: the last answer taken back, whichever of the three ways it was
     given. The card comes back from the side it left by, on the face it was
     answered from, with the tallies, the queue, the count the stages open on
     and whether it had been hinted all as they were — mark() wrote each of
     them down before it touched them. One answer deep, the way the undo on
     every card app is: the one somebody means is the one that just went. */
  function undo() {
    var run = state.run;
    var u = run && run.last;
    if (!u || run.flying) return;
    var key = from(u.word) + '/' + u.word.id;

    run.last = null;
    run.pending = null;
    u.word.known = u.known;
    state.words = u.words;
    run.queue.length = u.length;
    run.at = u.at;
    run.turned = u.turned;
    run.hint = u.hint;
    if (u.back) run.back[key] = u.back; else delete run.back[key];
    if (u.said) run.said[key] = u.said; else delete run.said[key];
    run.knew = u.tallyKnew;
    run.again = u.tallyAgain;

    TTBTrack.event('flash_undo', { deck_id: state.deck.id, was: u.knew ? 'knew' : 'again' });
    run.returning = u.knew ? 'knew' : 'again';
    render();
    run.returning = null;
    focusRun();
  }

  /* An answer, with the card thrown off the side it was answered towards
     first — right and green for Knew it, left and red for Show me again —
     and then mark(). The same flight for a throw, a press and an arrow key,
     so that the three ways of answering look like the same answer.
   *
     `flying` holds everything else off for the moment the card is
     in the air, so a second tap does not answer the next card unseen. And
     the answer is given only if the card is still the one in hand when it
     lands: anything that took the run away meanwhile has said what it wanted
     instead. */
  var FLIGHT_MS = 450;

  function answer(word, knew, how) {
    var run = state.run;
    if (run.flying) return;
    var node = main.querySelector('.flash-card');
    /* Somebody who has asked the page to hold still gets the card swapped
       rather than thrown. */
    var still = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!node || still) { mark(word, knew, how); return; }

    run.flying = true;
    var dir = knew ? 1 : -1;
    var far = Math.round((node.offsetWidth || 320) * 1.2 + 40);
    var verdict = node.querySelector('.flash-verdict');
    if (verdict) {
      verdict.textContent = knew ? t('flashKnew') : t('flashAgain');
      verdict.className = 'flash-verdict ' + (knew ? 'is-knew' : 'is-again');
      verdict.style.opacity = '1';
    }
    node.classList.remove('is-dragging', 'leans-knew', 'leans-again');
    node.classList.add('is-leaving', knew ? 'leans-knew' : 'leans-again');
    node.style.setProperty('--lean', '1');
    /* Read once so the browser has the card where it is now before it is
       told where to go, or a press would jump it straight to the end. */
    void node.offsetWidth;
    node.style.transform = 'translateX(' + (dir * far) + 'px) rotate(' + (dir * 14) + 'deg)';
    node.style.opacity = '0';

    setTimeout(function () {
      run.flying = false;
      if (state.run !== run || current() !== word) return;
      mark(word, knew, how);
    }, FLIGHT_MS);
  }

  /* The card itself. A <button>, so the thumb, the keyboard and the screen
     reader all get the same thing — see .flash-card in assets/flashcard.css
     for why the whole card is the target and not a word on it. */
  function faceCard(word) {
    var turned = state.run.turned;
    var face = el('div', { className: 'flash-face' }, turned
      ? [
          /* The Estonian again, small, over what it means — on a card without
             the three forms below, which would otherwise be the one place on
             the answering side where the word being learnt did not appear at
             all. A card with forms says it there, first of the three. */
          word.forms ? null : el('p', { className: 'flash-echo', textContent: word.front }),
          el('p', { className: 'flash-back', textContent: means(word.back) }),
          /* The three forms, on the side that answers. A dictionary gives an
             Estonian noun as three — the nominative, the genitive and the
             partitive — because the last two are where the stem actually
             shows itself, and somebody who has learnt only the first cannot
             say "two coffees" or "without bread". The front stays one word:
             what is being asked is still "what does this mean". */
          word.forms ? el('p', { className: 'flash-forms' }, [
            el('span', { className: 'flash-form is-first', textContent: word.front }),
            el('span', { className: 'flash-form', textContent: word.forms[0] }),
            el('span', { className: 'flash-form', textContent: word.forms[1] })
          ]) : null,
          /* And the word in a sentence, at the foot of the card. A word on its
             own is a thing to recognise; a word in a sentence is a thing to
             say, and the case it is standing in there is half of what the
             three forms above are for. The Estonian leads and what it means is
             under it in the quieter tone, which is the order the card itself
             is in. */
          word.sentence ? el('p', { className: 'flash-sentence' }, [
            el('span', { className: 'flash-said', textContent: word.sentence.et }),
            el('span', { className: 'flash-means', textContent: means(word.sentence) })
          ]) : null
        ]
      : [
          el('p', { className: 'flash-front', textContent: word.front }),
          /* The first letters of the answer, where they have been asked for.
             On the card rather than under it, in the quieter of the two faces
             the back uses, because it is part of the word being asked rather
             than a control: what changed when the button was pressed is the
             card, and a hint standing under it would leave the card looking
             untouched. See hintLine(). */
          state.run.hint ? el('p', { className: 'flash-hint', textContent: hintOf(word) }) : null
        ]);

    /* The line at the foot of the card — what to do with it, or whether you
       knew it — hung on the card rather than inside the face. It is placed
       absolutely against the card, and the face settles in on a transform,
       which makes the face the box it is placed against for as long as the
       animation runs: it stood at the foot of the words, mid-card, for a
       sixth of a second on every turn and then dropped to the foot. See
       .flash-card > .flash-turn in assets/flashcard.css. */
    var foot = el('p', { className: 'flash-turn', textContent: t(turned ? 'flashTurned' : 'flashTurn') });

    /* The word the card is heading for while it is being dragged. Drawn
       empty and filled by the drag, so nothing is built mid-gesture, and it
       says the answer in words as well as in the green or red the card leans
       into — design rule 10: a tint on its own says nothing to somebody who
       cannot see this one. */
    var verdict = el('p', { className: 'flash-verdict', 'aria-hidden': 'true' });

    /* No aria-live on it, and that is deliberate rather than an omission. It
       carried one, on a node render() replaces whole every time anything is
       pressed — which is the one arrangement a live region does not reliably
       announce, and where it does work it says the same thing taking the focus
       is about to say, twice. focusRun() below is what took over the job. */
    var node = el('button', {
      type: 'button',
      className: 'flash-card' + (turned ? ' is-turned' : '') +
                 (state.run.returning ? ' is-back-' + state.run.returning : '')
    }, [verdict, face, foot]);

    /* Wired on both faces, and it answers on both — the header of swipe()
       says why the front answers a throw and not a button. What comes back is
       the other thing the front needs from it: whether a drag happened, so
       that a scroll which started on the card does not turn it over on the
       way past. */
    var dragged = swipe(node, verdict, word);

    node.addEventListener('click', function () {
      /* A drag ends in a click too, and a card that turned over at the end of
         every swipe would show the next word's answer before its question.
         The press is still the only thing wired for turning it, because a
         keyboard and a screen reader activate a button without ever sending a
         pointer anywhere near it. */
      if (dragged() || state.run.flying) return;
      state.run.turned = !state.run.turned;
      if (state.run.turned && !turnSaid) {
        turnSaid = true;
        TTBTrack.event('flash_turn', { deck_id: state.deck.id });
      }
      render();
      focusRun();
    });

    return node;
  }

  /* Whether this load has reported flash_turn. Turning a card over is the
     first thing anybody does with one, and it reported nothing: somebody who
     arrived on a deck, turned five cards and closed the tab was a view that
     ended with nothing pressed, the same as somebody who never saw a card —
     and that was most of the flashcards' "idle" share, 62 of 103 views from
     1 to 5 October, against seventy seconds on screen a view. So the first
     turn of a load is reported, and only the first: every turn after it is
     already said by the flash_knew or flash_again that follows it, and a
     second name per card would only double the tally. */
  var turnSaid = false;

  /* Where the keyboard is after anything that starts or advances a run: the
     card turned over, a card answered, and the three buttons that build a run
     of a whole deck.
   *
     Every press in a run rebuilds the whole of <main>, so the element that had
     the focus is gone and the browser drops it on the body. Turning a card
     with the keyboard therefore meant tabbing in from the top of the page
     again, once per card, for the length of the deck — and a screen reader was
     told nothing at all about the word that had just appeared, because nothing
     had moved and the card's own live region was being replaced rather than
     updated.

     The new card is the answer to both. It is a <button>, so taking the focus
     announces it and the words on it, and it is the one thing on the screen a
     run is about. At the end of a run there is no card and the focus goes to
     <main>, which carries tabindex="-1" for the skip link and is the same
     landing the skip link uses.

     A thumb and a mouse are unaffected: focus moved by a script after a
     pointer press draws no focus ring, which is the whole of what :focus-visible
     is for. */
  function focusRun() {
    var card = main.querySelector('.flash-card');
    (card || main).focus();
  }

  /* ------------------------------------------------------------- the swipe
   * Left for Show me again, right for Knew it: the same two answers as the
   * buttons under the card, given with the thumb that is already on it. The
   * buttons stay — this is a second way to say the same thing, not a
   * replacement, and a gesture nobody discovers would otherwise be the only
   * way to use the page. The arrow keys are the third and are the same two
   * directions on a machine with no thumb on it — see wireKeys() below.
   *
   * It answers on either face, and that is the one way it differs from the
   * buttons, which are not drawn until the card is turned. A word you know on
   * sight is answered before the card is turned over, and one you do not know
   * is a Show me again before the back could add anything: it goes to the end
   * of the run and is turned over when it comes round. It did not use to — a
   * throw on the front did nothing, on the reasoning that the front has
   * nothing to answer — and what that cost was a tap on every card before it
   * could be got wrong. The buttons stay behind the turn because a Knew it
   * drawn under a word whose meaning nobody has seen invites a press that
   * cannot mean anything; a throw is a decision already made, and it takes a
   * quarter of the card to mean it.
   *
   * Pointer events rather than touch events, so one set of handlers covers a
   * thumb, a mouse and a stylus. setPointerCapture is what keeps the card
   * following a finger that has wandered off the edge of it.
   *
   * The card only takes the gesture over once it is clear the gesture is
   * horizontal. Until then a drag might be somebody scrolling the page, and
   * a card that grabbed every touch would make the page impossible to scroll
   * on a phone — which is most of them. `touch-action: pan-y` in
   * assets/flashcard.css is the other half of that: the browser keeps
   * vertical scrolling and hands this the horizontal.
   */
  var SWIPE_SLOP = 8;

  function swipe(node, verdict, word) {
    var startX = 0;
    var startY = 0;
    var dx = 0;
    var live = false;   // the gesture is ours: past the slop, and horizontal
    var moved = false;  // past the slop at all, whichever way it went
    var down = false;

    /* Measured once, when the finger lands, for the reason wireSheet() in
       assets/app.js gives about its own stops: nothing that decides where a
       gesture ends can change while the gesture is running, and reading it per
       move is a layout on every frame of a drag.

       `far` is how far it has to go to mean anything — a quarter of the card,
       which is a real movement of the thumb on a phone and a short one on a
       laptop, with a floor so it cannot become a twitch on a narrow screen. */
    var width = 0;
    var far = 0;

    function draw() {
      var past = Math.min(1, Math.abs(dx) / far);
      /* Eight degrees at the far end. A card that turns as it goes reads as a
         thing being moved rather than a thing sliding, which is what tells
         this gesture from a scroll that got away. */
      node.style.transform = 'translateX(' + Math.round(dx) + 'px) rotate(' + (dx / width * 8).toFixed(2) + 'deg)';
      verdict.textContent = dx > 0 ? t('flashKnew') : t('flashAgain');
      verdict.className = 'flash-verdict ' + (dx > 0 ? 'is-knew' : 'is-again');
      verdict.style.opacity = String(past);
      /* And the card leans the same way, green or red, as far as the drag
         has gone towards meaning it — the lean in assets/flashcard.css. */
      node.classList.toggle('leans-knew', dx > 0);
      node.classList.toggle('leans-again', dx < 0);
      node.style.setProperty('--lean', past.toFixed(3));
    }

    function rest() {
      node.classList.remove('is-dragging', 'leans-knew', 'leans-again');
      node.style.transform = '';
      node.style.removeProperty('--lean');
      verdict.style.opacity = '0';
    }

    node.addEventListener('pointerdown', function (ev) {
      if (ev.button !== undefined && ev.button !== 0) return;
      if (state.run.flying) return;
      down = true;
      live = false;
      moved = false;
      dx = 0;
      startX = ev.clientX;
      startY = ev.clientY;
      width = node.offsetWidth || 1;
      far = Math.max(64, width * 0.25);
    });

    node.addEventListener('pointermove', function (ev) {
      if (!down) return;
      var moveX = ev.clientX - startX;
      var moveY = ev.clientY - startY;

      if (!live) {
        if (Math.abs(moveX) < SWIPE_SLOP && Math.abs(moveY) < SWIPE_SLOP) return;
        /* Something moved, whichever way, and that is enough to mean this was
           not a press — see the note on the returned function below. Only the
           horizontal half goes on to be an answer. */
        moved = true;
        /* A gesture down the page ends here rather than going on to be an
           answer: it belongs to the page. It has set `moved`, so it will not
           turn the card when the finger comes up either; what it will not do
           is move it. */
        if (Math.abs(moveY) >= Math.abs(moveX)) { down = false; return; }
        live = true;
        node.classList.add('is-dragging');
        if (node.setPointerCapture) {
          try { node.setPointerCapture(ev.pointerId); } catch (e) { /* older browser, and it still works */ }
        }
      }

      dx = moveX;
      draw();
    });

    var release = function () {
      if (!down) return;
      down = false;
      if (!live) return;

      if (Math.abs(dx) >= far) {
        /* Answered, and the card carries on the way the thumb sent it, off
           the edge in its answer's colour — answer() above. It used to be
           left where the finger put it, and a right and a left looked the
           same the moment the finger came up. */
        answer(word, dx > 0, 'swipe');
        return;
      }
      rest();
    };

    node.addEventListener('pointerup', release);
    node.addEventListener('pointercancel', function () {
      down = false;
      live = false;
      rest();
    });

    /* Whether the gesture that just ended was a drag rather than a press —
       asked by the click handler, which fires after pointerup and has no
       other way of telling.
     *
       It is `moved` and not `live`, so a drag down the page suppresses the
       turn as surely as a drag across it does. That is the sheet's rule in
       assets/app.js, where any movement past four pixels stops the release
       counting as a tap, and it is right for the same reason: somebody who
       has just scrolled has not asked for anything, and a card that turned
       over at the end of every scroll would be showing them the answer to a
       word they had not read.

       It answers once and forgets, so the next press starts from nothing. */
    return function () {
      var was = moved;
      moved = false;
      return was;
    };
  }

  /* --------------------------------------------------------- and the arrows
   * The throw, for a machine with nothing to throw with. The right arrow is
   * Knew it and the left arrow is Show me again — the same two answers the
   * buttons give and the same two the swipe gives, in the same direction the
   * card would have gone under a thumb, so somebody who has turned these over
   * on a phone already knows which way is which on a laptop.
   *
   * It answers on either face, because the swipe does and this is the swipe:
   * a word known on sight is answered before the card is turned over, and the
   * buttons stay behind the turn for the reason the header above gives.
   * Turning the card over needs nothing here — focusRun() leaves the focus on
   * the card after every answer, and a <button> with the focus on it is
   * turned over by Enter or by the space bar without a line of script.
   *
   * On the document rather than on the card, so a run answers the keyboard
   * wherever the focus is actually sitting: on All the decks, on Show me
   * again, on a card that has just been reported wrong, or on nothing at all
   * after a press somewhere idle. The alternative is an arrow that works only
   * while the one element nobody deliberately focused still has the focus,
   * which is a keyboard shortcut that mostly does not work.
   */
  function wireKeys() {
    /* The answer Undo was holding goes with the tab — flush(). pagehide for
       the tab closing, and visibilitychange for a phone that puts a tab away
       and may never wake it again. */
    window.addEventListener('pagehide', function () { flush(true); });
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'hidden') {
        var had = state.run && state.run.last;
        flush(true);
        if (had && current()) render();
      }
    });

    document.addEventListener('keydown', function (ev) {
      /* Undo is Control-Z, or Command-Z on a Mac, which is what it is
         everywhere else — and the same rules as the arrows below about
         fields and the language menu, since in a field it is the field's. */
      var undoKey = (ev.key === 'z' || ev.key === 'Z') && (ev.ctrlKey || ev.metaKey) && !ev.altKey && !ev.shiftKey;
      if (undoKey) {
        var at = ev.target;
        if (at && (at.isContentEditable || /^(?:INPUT|TEXTAREA|SELECT)$/.test(at.tagName))) return;
        if (window.TTBLanguage.isOpen()) return;
        if (!state.run || !state.run.last || state.editing || state.gated) return;
        ev.preventDefault();
        undo();
        return;
      }

      /* S says the card aloud — the word, or the sentence where the back is
         up and has one: sayCard(). Under every rule the arrows are under,
         since an S in a field is a letter. */
      var sayKey = ev.key === 's' || ev.key === 'S';
      if (!sayKey && ev.key !== 'ArrowLeft' && ev.key !== 'ArrowRight') return;

      /* An arrow with a modifier on it belongs to the browser or to a
         selection and never to the card: Alt and the left arrow is Back on
         Windows, and Command and the left arrow is Back on a Mac. Answering a
         card on the way out of the page would be the worst of both. */
      if (ev.altKey || ev.ctrlKey || ev.metaKey || ev.shiftKey) return;
      if (ev.defaultPrevented) return;

      /* Nothing while anybody is typing. The editor is rows of fields of
         Estonian and the form under the gate is a name and a password; an
         arrow in one of those is the caret moving, and a card answered out
         from under somebody mid-word is a word spent on a keystroke that was
         about something else. */
      var on = ev.target;
      if (on && (on.isContentEditable || /^(?:INPUT|TEXTAREA|SELECT)$/.test(on.tagName))) return;

      /* And nothing behind an open language menu, which stands over the card
         and is the thing the keyboard is in while it is open — the same rule
         the press anywhere else is under, in assets/language.js. */
      if (window.TTBLanguage.isOpen()) return;

      /* Only where a card is really on screen, which is the condition
         render() draws one under. The run outlives the two views that are not
         it — the editor, and the gate — so current() still has a word in hand
         on both, and answering it there would spend a card of a deck from a
         page that is showing a form. */
      if (!state.deck || state.editing || state.gated) return;
      var word = current();
      if (!word) return;

      if (sayKey) {
        if (!sayable(word)) return;
        ev.preventDefault();
        sayCard(word);
        return;
      }

      /* Left to itself an arrow scrolls the page sideways, which on a phone-
         width window is the card leaving. */
      ev.preventDefault();
      answer(word, ev.key === 'ArrowRight', 'key');
    });
  }

  /* The two tallies, over the card: what is still being learnt on the left and
     what is known on the right, of the cards this run has answered so far.
   *
     They are not the bar over them wearing different words. That one says
     how far through the deck this sitting is — a fact about the queue — and
     these say how the sitting is going, which is the thing somebody actually
     wants to know halfway down a deck and the thing that makes them finish it.
     Both start at nought and they always add up to the cards answered.
   *
     A row of their own under the bar rather than either end of it. Three numbers on one line is two too many at 390 px, which is the
     phone this page is measured against, and the bar's own count is the one
     that would have had to go.
   *
     The label is the mono every label on this site is in and the number is
     against it in the display face, which is the arrangement the end of a run
     already uses for the score it prints. Nothing here is pressable: they are
     facts about the run, and a count that looks like a button is a count
     somebody presses. */
  function tallyRow() {
    var run = state.run;

    var side = function (key, n, cls) {
      return el('span', { className: 'flash-tally-side ' + cls }, [
        el('span', { className: 'flash-tally-n', textContent: String(n) }),
        el('span', { className: 'flash-tally-say', textContent: t(key) })
      ]);
    };

    /* Undo stands between them, once there is an answer to take back. The
       arrow is aria-hidden because the word beside it is the whole of what
       it says. */
    var back = null;
    if (run.last) {
      back = el('button', { type: 'button', className: 'alt flash-undo' }, [
        el('span', { className: 'flash-undo-arrow', 'aria-hidden': 'true', textContent: '\u21B6' }),
        el('span', { textContent: t('flashUndo') })
      ]);
      back.addEventListener('click', undo);
    }

    return el('div', { className: 'flash-tally' }, [
      side('flashLearning', run.again, 'is-again'),
      back,
      side('flashKnow', run.knew, 'is-knew')
    ]);
  }

  /* The first letters of what the word means, for somebody who has it on the
     tip of their tongue and would otherwise have to turn the card over and
     lose it.
   *
     Two letters, or three where the word is long enough that two say nothing.
     The meaning is taken in whichever of the three languages this page is
     being read in, so a hint is in the alphabet the answer is in rather than
     always in English — Здр… for Здравствуйте.
   *
     Two rules past that, and both are about the meanings that are a phrase
     rather than a word, which is a good third of the decks.
   *
     **Half of a word, and no more**, so that a short one is not given away by
     the thing that was meant to help it: Ice hints I…, and a meaning of one
     letter — there are two of them, both Russian prepositions — hints nothing
     at all and draws no button. It applies to a word standing on its own and
     not to a phrase, because the rest of a phrase is still hidden: How are
     you? hints Ho…, where halving the first word would have hinted H… and
     said nothing anybody could use.
   *
     **And a phrase that opens with a very short word carries it along whole**
     — to bring hints to br…, not to…. The little word is not the lesson and
     spending the hint on it is the same as not offering one.
   *
     An empty string means there is nothing here worth hinting, and hintLine()
     below draws no button rather than one that hands over an ellipsis. */
  function hintOf(word) {
    var said = means(word.back).replace(/\s+/g, ' ').trim();
    if (!said) return '';

    var words = said.split(' ');
    var lead = '';
    while (words.length > 1 && words[0].length <= 2) {
      lead += words.shift() + ' ';
    }

    var first = words[0];
    var take = first.length >= 6 ? 3 : 2;
    if (words.length === 1 && !lead) take = Math.min(take, Math.floor(first.length / 2));
    if (take < 1) return '';

    return lead + first.slice(0, take) + '…';
  }

  /* And the press that asks for it, under the card and on the front of it
     only — the back is the answer, and a hint there would be a button offering
     what is already on the screen.
   *
     Under rather than on the card, which is where the apps that have one of
     these put it: the card is itself a <button>, so that the thumb, the
     keyboard and the screen reader all get one target, and nothing pressable
     can stand inside one. It is an .alt, alone on the row the two answers
     take over the moment the card is turned.
   *
     Pressed, it is gone and the letters are on the card. One hint and not a
     slow reveal: a second press would be a way of turning the card over
     without saying so.
   *
     The answer afterwards is still both answers. A Knew it that needed a hint
     is not quite a Knew it, and the honest-looking thing would be to take that
     press away — but every card here is answered with one boolean, did you
     know it, and a page that decides that on somebody's behalf is a page arguing
     with them about their own memory. So the card is answered the way every
     card is and the event carries `hint`, which is what will say in a month
     whether people hint and then know. See **The hint** in README.md. */
  function hintLine(word) {
    if (state.run.hint || !hintOf(word)) return null;

    var ask = el('button', { type: 'button', className: 'alt', textContent: t('flashHint') });
    ask.addEventListener('click', function () {
      state.run.hint = true;
      TTBTrack.event('flash_hint', { deck_id: state.deck.id });
      render();
      focusRun();
    });

    return el('div', { className: 'flash-hintline' }, [ask]);
  }

  /* ------------------------------------------------------------ hearing it
   * The Estonian, said aloud: the word on the front, and on the back the word
   * again and the sentence under it where the card has one. A word read is
   * half a word — leib and leiba are one thing on the page and two in the
   * mouth — and the people turning these over have mostly never heard any of
   * them.
   *
   * The sound is nobody's file. /api/say asks the University of Tartu's
   * Estonian voice for the words when the button is pressed, and Cloudflare
   * keeps what comes back, so the second person to press Tere hears it from
   * the edge — see the header of functions/api/say.js. This side only hands
   * an address to one <audio> and follows what it does.
   *
   * One <audio> for the whole sitting, made on the first press and pointed at
   * each word in turn, because a phone lets a page play sound only from a
   * gesture and an element that has played once from one keeps being allowed
   * to. The radio has its own and neither touches the other.
   *
   * render() rebuilds <main> on every press, so what the buttons show lives
   * here rather than on them: `text` is what is being said and `now` whether
   * it is still on its way or already playing, and paintSay() puts that on
   * whichever buttons are on screen. A sound whose button has gone — the card
   * was answered, the deck was left — is stopped by render() itself, which is
   * the one place every one of those passes through.
   */
  var SAY_API = '/api/say';

  /* Which recording of a word to ask for. The route answers with thirty days
     of cache, so a browser that has heard a word keeps it by its address for a
     month, and a change to how the voice sounds — VOICE or SPEED in
     functions/api/say.js — would reach nobody who had already pressed the
     button. So every address carries this, and it goes up by one with either:
     2 is the voice at its own pace, after 0.9 sounded robotic. The route does
     not read it; the edge keys on the voice and the pace itself. */
  var SAY_TAKE = 2;

  var voice = { audio: null, text: '', now: '', token: 0 };

  /* Only a card out of data/decks.json can be said, because that file is the
     whole of what the route will speak — a deck somebody typed is anything
     anybody chose, and the header of the route says why that stays unsaid. A
     shipped card's back is an object keyed by language and a typed one's is
     a string, and that holds in the gathered decks too, where the two are
     mixed. */
  function sayable(word) {
    return !!word && !state.deck.own && !!word.back && typeof word.back === 'object';
  }

  function paintSay() {
    var buttons = main.querySelectorAll('.flash-say');
    for (var i = 0; i < buttons.length; i++) {
      var b = buttons[i];
      var mine = b.getAttribute('data-say') === voice.text;
      b.classList.toggle('is-loading', mine && voice.now === 'loading');
      b.classList.toggle('is-playing', mine && voice.now === 'playing');
      b.setAttribute('aria-pressed', mine && voice.now ? 'true' : 'false');
    }
  }

  function hush() {
    voice.token++;
    if (voice.audio) voice.audio.pause();
    voice.text = '';
    voice.now = '';
    paintSay();
  }

  /* A second press on the one that is sounding stops it; a press on another
     one starts that one instead. Whatever goes wrong — the voice is down, the
     phone is offline, the browser refused — ends the same way: quiet, and one
     line saying the voice is not answering. The card goes on working, since
     nothing in a run waits on this. */
  function sayIt(text, what) {
    if (voice.text === text && voice.now) { hush(); return; }
    hush();

    if (!voice.audio) voice.audio = new Audio();

    var token = voice.token;
    var audio = voice.audio;
    var ours = function () { return token === voice.token; };
    var failed = function () {
      if (!ours()) return;
      hush();
      toast(t('flashSayFail'));
    };

    audio.onplaying = function () { if (ours()) { voice.now = 'playing'; paintSay(); } };
    audio.onended = function () { if (ours()) hush(); };
    audio.onerror = failed;

    voice.text = text;
    voice.now = 'loading';
    audio.src = SAY_API + '?take=' + SAY_TAKE + '&text=' + encodeURIComponent(text);
    var played = audio.play();
    /* A play() that was stopped by the next press rejects with an AbortError,
       which is this page changing its mind rather than anything failing. */
    if (played && played.catch) {
      played.catch(function (e) { if (!e || e.name !== 'AbortError') failed(); });
    }
    paintSay();

    TTBTrack.event('flash_say', { deck_id: state.deck ? state.deck.id : state.song ? state.song.id : '', what: what });
  }

  /* What the S key says: the sentence where the back is up and there is one,
     and the word otherwise — the same thing the last button in the row would
     say. */
  function sayCard(word) {
    if (!sayable(word)) return;
    if (state.run.turned && word.sentence && word.sentence.et) sayIt(word.sentence.et, 'sentence');
    else sayIt(word.front, 'word');
  }

  /* The row of them, under the card and over whatever answers it. On the
     front, one press for the word. On the back, the word again and, where
     there is one, the sentence — both there because the sentence is the thing
     to say and the word is the thing to learn, and somebody who wanted one has
     usually just heard the other.
   *
     Under rather than on the card for the reason the hint is: the card is a
     <button>, and nothing pressable can stand inside one. .alt like every
     other quiet press here, with the speaker drawn beside the word the way
     Undo draws its arrow. */
  function sayLine(word) {
    if (!sayable(word)) return null;

    var one = function (text, key, what) {
      var b = el('button', {
        type: 'button',
        className: 'alt flash-say',
        'data-say': text,
        'aria-pressed': 'false',
        'aria-label': t('flashSayAria', { text: text })
      }, [
        el('span', { className: 'flash-say-icon', 'aria-hidden': 'true' }),
        el('span', { textContent: t(key) })
      ]);
      b.addEventListener('click', function () { sayIt(text, what); });
      return b;
    };

    var kids = [];
    if (!state.run.turned) {
      kids.push(one(word.front, 'flashSay', 'word'));
    } else {
      kids.push(one(word.front, 'flashSayWord', 'word'));
      if (word.sentence && word.sentence.et) kids.push(one(word.sentence.et, 'flashSaySentence', 'sentence'));
    }
    return el('div', { className: 'flash-sayline' }, kids);
  }

  function runBar() {
    var run = state.run;
    var done = run.at;
    var all = run.queue.length;
    var fill = el('span', { className: 'flash-fill' });
    fill.style.width = (all ? Math.round((done / all) * 100) : 0) + '%';

    return el('div', { className: 'flash-bar' }, [
      el('span', { className: 'flash-count', textContent: t('flashAt', { at: done + 1, n: all }) }),
      el('span', { className: 'flash-track', 'aria-hidden': 'true' }, [fill])
    ]);
  }

  /* The head of a run: which deck this is, the way back out of it, and
     — on a deck of your own — the word that opens the editor.
   *
     The way out is here rather than under the card, and that is the second
     arrangement. It was an .alt in the row of controls, which meant it was
     drawn on the front of a card and replaced by Knew it and Show me again the
     moment one was turned over: halfway through a deck, having turned a card,
     there was nothing on the screen that left. Standing it in the head keeps
     it in one place whichever face is up, and leaves the row under the card
     saying only the two things that answer the card. */
  function runHead() {
    var kids = [
      el('span', { className: 'eyebrow', textContent: deckName(state.deck) }),
      backOut({ deck_id: state.deck.id })
    ];

    if (state.deck.own) {
      var edit = el('button', { type: 'button', className: 'alt', textContent: t('flashEdit') });
      edit.addEventListener('click', function () {
        state.editing = true;
        render();
      });
      kids.push(edit);
    }

    return el('div', { className: 'flash-deck' }, kids);
  }

  function studyView(word) {
    /* Neither answer under the card until it has been turned. Drawing Knew it
       against a word whose meaning nobody has seen yet would be inviting a
       press that cannot mean anything — and the way out of the deck is in the
       head above, where it stands whichever face is up. The card itself is
       the exception: it can be thrown from the front, and the header of
       swipe() says why a throw is not the invitation a drawn button would be.

       What does stand there on the front is the hint, which is the one press
       that belongs to a card nobody has seen the meaning of yet — and it is
       gone by the time the two answers arrive, so the row under the card asks
       one thing at a time either way. See hintLine(). Over both, on either
       face, the word said aloud, which is not a question about the card at
       all: see sayLine(). */
    if (!state.run.turned) {
      return [runHead(), runBar(), tallyRow(), pile(word), sayLine(word), hintLine(word)];
    }

    var acts = el('div', { className: 'flash-acts' });

    var again = el('button', { type: 'button', className: 'alt', textContent: t('flashAgain') });
    again.addEventListener('click', function () { answer(word, false, 'press'); });
    acts.appendChild(again);

    var knew = el('button', { type: 'button', className: 'go', textContent: t('flashKnew') });
    knew.addEventListener('click', function () { answer(word, true, 'press'); });
    acts.appendChild(knew);

    return [runHead(), runBar(), tallyRow(), pile(word), sayLine(word), acts, wrongLine(word)];
  }

  /* The card in hand, standing on the edges of the ones still under it. The
     two edges are the wrapper's own, drawn in assets/flashcard.css, so they
     stay put while the card on top is dragged or thrown: what is revealed
     under a card on its way off the screen is the rest of the deck, which is
     what is actually there. Only while more than this one card is left —
     the last card of a run is the last card, and stands on nothing. */
  function pile(word) {
    var left = state.run.queue.length - state.run.at - 1;
    return el('div', { className: 'flash-pile' + (left > 0 ? ' has-more' : '') }, [faceCard(word)]);
  }

  /* --------------------------------------------------- this card is wrong
   * Under the two answers rather than beside them. The row above says what to
   * do with the word and this says what to do about the card, which is a
   * different question and a much rarer one — and a third control in that row
   * would make the page look like it was asking three things at once.
   *
   * Only on a deck the site ships. A deck you wrote has an editor with a
   * Remove on every row, so reporting your own words to me would be a loop,
   * and the gathered decks are somebody's own rows about cards that are all
   * reportable in the deck they came from.
   *
   * The Estonian here is mine and has not been read by anybody who grew up
   * with the language. The people turning these over are the only proofreaders
   * it has. See **This card is wrong** under **Flashcards** in README.md.
   */
  function wrongLine(word) {
    if (state.deck.own || gathered(state.deck)) return null;

    /* role="status" because the press destroys the thing that was pressed:
       the button is gone by the time this is drawn, so a screen reader that
       was on it has nothing left to read and no reason to look here. The card
       answers the same problem the other way, by taking the focus — see
       focusRun() — which this line cannot, being a sentence rather than
       something to press. */
    if (word.reported) {
      return el('p', {
        className: 'flash-wrong flash-turn',
        role: 'status',
        textContent: t('flashWrongDone')
      });
    }

    /* This one does wait for the write, unlike the two above it. They are
       pressed a hundred times in a sitting and are silent when they fail
       because the cost of failing is that the card comes round again;
       this is pressed once, deliberately, and somebody who has just told me
       something is wrong should not be told it landed when it did not. */
    var btn = el('button', { type: 'button', className: 'alt', textContent: t('flashWrong') });
    btn.addEventListener('click', function () {
      if (btn.disabled) return;
      btn.disabled = true;
      post(FLASH_API, {
        action: 'report',
        deck: from(word),
        card: word.id,
        /* Which of the three backs was on screen, which is the most useful
           thing this press can carry: the route stores it. */
        lang: state.lang
      }).then(function (a) {
        if (!a.ok) { btn.disabled = false; toast(say(a.out)); return; }
        TTBTrack.event('flash_wrong', { deck_id: state.deck.id, lang: state.lang });
        word.reported = true;
        render();
      });
    });

    return el('p', { className: 'flash-wrong' }, [btn]);
  }

  function backOut(params) {
    return TTBTrack.click(
      inPage(el('a', { className: 'alt', href: at(HOME), textContent: t('flashDecks') }), ''),
      'flash_back', params
    );
  }

  /* ------------------------------------------------------------ the end of it */

  /* A deck with nothing waiting: everything in it has been answered right,
     and a card known stays known. It is not the end-of-run card — there was
     no run — and it is not an error, it is a deck finished. The way
     past it is the same words the end of a run offers. */
  function restedCard() {
    var acts = el('div', { className: 'flash-doneacts' });

    var anyway = el('button', { type: 'button', className: 'go', textContent: t('flashAnyway') });
    anyway.addEventListener('click', function () {
      TTBTrack.event('flash_anyway', { deck_id: state.deck.id });
      startRun(true);
      render();
      focusRun();
    });
    acts.appendChild(anyway);

    return el('section', { className: 'card flash-done' }, [
      el('p', { className: 'flash-score', textContent: knownCount() + ' / ' + (state.deck.cards || []).length }),
      el('p', { className: 'lists-say', textContent: t('flashNothingDue') }),
      acts
    ]);
  }

  function doneCard() {
    var all = (state.deck.cards || []).length;
    var mine = knownCount();
    var acts = el('div', { className: 'flash-doneacts' });

    var again = el('button', { type: 'button', className: 'go', textContent: t('flashGoAgain') });
    again.addEventListener('click', function () {
      TTBTrack.event('flash_again_deck', { deck_id: state.deck.id });
      startRun(true);
      render();
      focusRun();
    });
    acts.appendChild(again);

    /* No way out of the deck here: the head above this card carries it, and
       two of them on one screen would be the page offering the same door
       twice. Only where there is something to forget, and only where it is kept
       anywhere — signed out the run was this tab's and closing it is the
       whole of forgetting.
     *
       The missed deck is the second sort of something, and it is not a count
       of what is known: every card in it is in box nought, so `mine` is nought
       there by construction and the button never appeared at all — on the one
       deck README.md names it for. What it forgets there is the nought on
       every card in it at once, wherever the card came from.

       The review deck is the opposite case and gets no button: `mine` is the
       whole of it by construction, and what the button would forget there is
       every row this person has, from every deck. That is not a thing to
       offer under a run somebody has just finished, so the deck it came from
       is where a card is forgotten — and the route refuses the id in any
       case. */
    if (state.user && state.ready && !state.deck.review && (mine > 0 || state.deck.missed)) {
      var wipe = el('button', { type: 'button', className: 'alt is-danger', textContent: t('flashForget') });
      wipe.addEventListener('click', function () {
        post(FLASH_API, { action: 'reset', deck: state.deck.id }).then(function (a) {
          if (!a.ok) { toast(say(a.out)); return; }
          TTBTrack.event('flash_reset', { deck_id: state.deck.id });
          /* The missed deck is those rows and nothing else, so forgetting it
             is the deck itself going: there is nothing left here to go
             through again, and the decks page is where it was. Every other
             deck is a file or a table and stays where it is. */
          if (state.deck.missed) { go('', true); return; }
          state.deck.cards.forEach(function (c) { c.known = false; });
          startRun(true);
          render();
          focusRun();
        });
      });
      acts.appendChild(wipe);
    }

    var kids = [
      el('p', { className: 'flash-score', textContent: mine + ' / ' + all }),
      el('p', { className: 'lists-say', textContent: mine >= all ? t('flashAllKnown') : t('flashSomeLeft', { n: all - mine }) })
    ];

    /* And a stage this run opened, said here because here is where it
       happened: one line, no button, the decks page is the way in as always.
       Rarely two, and then two lines. */
    opened().forEach(function (level) {
      kids.push(el('p', { className: 'lists-say flash-opened', textContent: t('flashOpened', { stage: t(level.key) }) }));
    });

    kids.push(acts);

    return el('section', { className: 'card flash-done' }, kids);
  }

  /* --------------------------------------------------------- writing a deck
   * A deck of your own, as a list of pairs rather than as cards to turn over.
   * It is the same page rather than another address: the deck is already
   * loaded, and a second address for the same deck would be a second thing to
   * get wrong in a link.
   */
  function cardRow(word) {
    /* Open, this row is the same two fields addCardForm below adds a card
       with, pre-filled and posting to a card that already exists rather than
       a new one — one form either way, so a typo is fixed the way it was
       made rather than by removing the card and typing it again at the back
       of the editor's list. Only one row opens at a time: state.editingCard
       is the id of it, or none. */
    if (state.editingCard === word.id) {
      var form = el('form', { className: 'ac-form' });
      form.appendChild(el('div', { className: 'flash-pairfields' }, [
        field('fc-efront', 'flashFront', { maxlength: String(MAX_SIDE) }),
        field('fc-eback', 'flashBack', { maxlength: String(MAX_SIDE) })
      ]));
      form.querySelector('#fc-efront').value = word.front;
      form.querySelector('#fc-eback').value = word.back;

      var cancel = el('button', { type: 'button', className: 'alt', textContent: t('flashCancelEdit') });
      cancel.addEventListener('click', function () {
        state.editingCard = null;
        render();
      });

      var acts = el('div', { className: 'flash-doneacts' }, [
        actor('flashSaveCard', 'go', function (done) {
          var front = value(form, 'fc-efront');
          var back = value(form, 'fc-eback');
          if (!front) { done(); complain(form, t('flashErrFront')); return; }
          if (!back) { done(); complain(form, t('flashErrBack')); return; }

          post(FLASH_API, { action: 'editcard', deck: state.deck.id, card: word.id, front: front, back: back })
            .then(function (a) {
              if (!a.ok || !a.out.deck) { done(); complain(form, say(a.out)); return; }
              TTBTrack.event('flash_editcard', { deck_id: state.deck.id });
              state.deck = a.out.deck;
              state.editingCard = null;
              startRun(true);
              done();
              render();
            });
        }, form),
        cancel
      ]);
      form.appendChild(acts);

      return el('li', { className: 'flash-row' }, [form]);
    }

    var edit = el('button', { type: 'button', className: 'alt', textContent: t('flashEditCard') });
    edit.addEventListener('click', function () {
      state.editingCard = word.id;
      render();
    });

    var drop = el('button', { type: 'button', className: 'alt is-danger', textContent: t('flashRemove') });
    drop.addEventListener('click', function () {
      if (drop.disabled) return;
      drop.disabled = true;
      post(FLASH_API, { action: 'uncard', deck: state.deck.id, card: word.id }).then(function (a) {
        if (!a.ok || !a.out.deck) { drop.disabled = false; toast(say(a.out)); return; }
        TTBTrack.event('flash_uncard', { deck_id: state.deck.id });
        state.deck = a.out.deck;
        startRun(true);
        render();
      });
    });

    return el('li', { className: 'flash-row' }, [
      el('span', { className: 'flash-pair' }, [
        el('span', { className: 'flash-side', textContent: word.front }),
        el('p', { className: 'flash-gloss', textContent: means(word.back) })
      ]),
      el('span', { className: 'flash-rowacts' }, [edit, drop])
    ]);
  }

  function addCardForm() {
    var form = el('form', { className: 'ac-form' });
    form.appendChild(el('div', { className: 'flash-pairfields' }, [
      field('fc-front', 'flashFront', { maxlength: String(MAX_SIDE), placeholder: t('flashFrontHint') }),
      field('fc-back', 'flashBack', { maxlength: String(MAX_SIDE), placeholder: t('flashBackHint') })
    ]));
    form.appendChild(actor('flashAdd', 'go', function (done) {
      var front = value(form, 'fc-front');
      var back = value(form, 'fc-back');
      if (!front) { done(); complain(form, t('flashErrFront')); return; }
      if (!back) { done(); complain(form, t('flashErrBack')); return; }

      post(FLASH_API, { action: 'card', deck: state.deck.id, front: front, back: back }).then(function (a) {
        if (!a.ok || !a.out.deck) { done(); complain(form, say(a.out)); return; }
        TTBTrack.event('flash_card', { deck_id: state.deck.id });
        state.deck = a.out.deck;
        startRun(true);
        done();
        render();
        /* Back to the first field with everything cleared: this form is used
           twenty times in a row and the thing wanted next is always the next
           word. render() has replaced the nodes, so the field is found again
           rather than held. */
        var next = document.getElementById('fc-front');
        if (next) next.focus();
      });
    }, form));
    return form;
  }

  function editView() {
    var deck = state.deck;
    var kids = [
      el('p', { className: 'eyebrow', textContent: t('flashYoursEyebrow') }),
      heading(deckName(deck)),
      el('p', { className: 'lists-say', textContent: t('flashEditWhy') })
    ];

    if (deck.cards.length) {
      var ul = el('ul', { className: 'flash-rows' });
      deck.cards.forEach(function (c) { ul.appendChild(cardRow(c)); });
      kids.push(ul);
    } else {
      kids.push(el('p', { className: 'lists-none', textContent: t('flashEditNone') }));
    }

    kids.push(addCardForm());

    /* The two ways out of the editor, and the one way out of the deck
       altogether. Delete is last and quiet: it is the one press on this page
       that cannot be taken back. */
    var back = el('button', { type: 'button', className: 'alt', textContent: t('flashDone') });
    back.addEventListener('click', function () {
      state.editing = false;
      state.editingCard = null;
      startRun(false);
      render();
      focusRun();
    });

    var drop = el('button', { type: 'button', className: 'alt is-danger', textContent: t('flashDropDeck') });
    drop.addEventListener('click', function () {
      if (!window.confirm(t('flashDropSure'))) return;
      if (drop.disabled) return;
      drop.disabled = true;
      post(FLASH_API, { action: 'drop', deck: state.deck.id }).then(function (a) {
        if (!a.ok) { drop.disabled = false; toast(say(a.out)); return; }
        TTBTrack.event('flash_drop', { deck_id: state.deck.id });
        go('', true);
      });
    });

    kids.push(foot([back, drop]));
    return card(kids);
  }

  /* ------------------------------------------------------------ the grammar
   * A lesson, read rather than turned over: the head a deck has, with Grammar
   * where the deck's name would be and the same way out, and under it one
   * card of prose — the name, the line under it, then the body's blocks in
   * order, and Got it at the foot. It is the sheet's own order, design rule
   * 6, and Got it is the one filled action on it.
   */
  function lessonHead() {
    return el('div', { className: 'flash-deck' }, [
      el('span', { className: 'eyebrow', textContent: t(followed(state.lesson) ? 'flashCases' : 'flashGrammar') }),
      backOut({ lesson_id: state.lesson.id })
    ]);
  }

  /* A paragraph, with the Estonian in it set apart: *…* in the data is an
     <i lang="et"> here, so the word being learnt reads as the word being
     learnt inside a sentence about it. The one piece of markup the content
     carries, and tools/validate.mjs holds the asterisks to pairs. */
  function prose(text) {
    return el('p', { className: 'flash-prose' }, text.split('*').map(function (part, i) {
      return i % 2 ? el('i', { lang: 'et', textContent: part }) : part;
    }));
  }

  /* A paradigm: three heads, and rows of three Estonian forms with what the
     word means at the end of each. The forms are lang="et" for the same
     reason the paragraph's are. */
  function paradigm(table) {
    var heads = table.heads.map(function (head) {
      return el('th', { scope: 'col', textContent: means(head) });
    });
    heads.push(el('th', { scope: 'col' }));
    var rows = table.rows.map(function (row) {
      var cells = row.et.map(function (form) { return el('td', { lang: 'et', textContent: form }); });
      cells.push(el('td', { textContent: means(row.means) }));
      return el('tr', null, cells);
    });
    return el('table', { className: 'flash-table' }, [
      el('thead', null, [el('tr', null, heads)]),
      el('tbody', null, rows)
    ]);
  }

  /* Sentences, each the Estonian over what it means — the card's own sentence
     drawn as a list, in the same two classes, so a sentence reads the same in
     a lesson as on the back of a card. A paragraph can only quote the
     Estonian inside an English sentence about it; this is the Estonian
     standing on its own line, the way it will be said. */
  function examples(list) {
    return el('ul', { className: 'flash-examples' }, list.map(function (one) {
      return el('li', null, [
        el('span', { className: 'flash-said', lang: 'et', textContent: one.et }),
        el('span', { className: 'flash-means', textContent: means(one) })
      ]);
    }));
  }

  function lessonCard() {
    var lesson = state.lesson;
    var kids = [
      heading(means(lesson.name)),
      lesson.why ? el('p', { className: 'lists-say', textContent: means(lesson.why) }) : null
    ];
    lesson.body.forEach(function (block) {
      if (block.say) kids.push(prose(means(block.say)));
      else if (block.head) kids.push(el('h2', { className: 'flash-lesson-head', textContent: means(block.head) }));
      else if (block.table) kids.push(paradigm(block.table));
      else if (block.examples) kids.push(examples(block.examples));
    });

    var got = el('button', { type: 'button', className: 'go',
                             textContent: t(followed(lesson) ? 'flashToCards' : 'flashGotIt') });
    got.addEventListener('click', function () {
      if (got.disabled) return;
      got.disabled = true;
      readLesson(lesson);
    });
    kids.push(foot([got]));

    var node = card(kids);
    node.classList.add('flash-lesson');
    return node;
  }

  /* Got it: the lesson is read — on the account where there is one, and in
     this tab where there is not, through keep(), the same store an answer
     with nobody to tell goes into — and the shelf is where you go next, at
     the place it was left. A case lesson goes on into its own deck instead,
     because that deck is the other half of it: the lesson says why *köögis*,
     the cards ask for it. Pressed on a lesson already read it is only the
     way on; the row it writes is the row that is there. The write is waited
     for before the next page is asked for, so the tile does not say Not read
     yet over a row that landed a moment later. */
  function readLesson(lesson) {
    lesson.read = true;
    TTBTrack.event('flash_lesson_read', { lesson_id: lesson.id });
    var back = function () { go(lesson.deck || '', true); };
    if (state.user && state.ready) {
      post(FLASH_API, { action: 'knew', deck: GRAMMAR, card: lesson.id }).then(back);
    } else {
      keep(GRAMMAR, lesson.id, true);
      back();
    }
  }

  /* ------------------------------------------------------------------ a song
   * Listened to rather than turned over: the video, and under it the song line
   * by line — the Estonian, what it means, and a speaker that says the line
   * slowly in the voice the cards use. Every word in a line is a press, and
   * pressing one opens a box under its line saying what the word means here,
   * which form it comes from, a note where one is owed, and where on the shelf
   * the word is taught. One box open at a time, and pressing its word again
   * shuts it.
   *
   * The box opens and shuts in place rather than through render(), because
   * render() rebuilds <main> and that would start the video again from the
   * beginning on every press. Nothing else on this page is on screen long
   * enough for that to matter; a song is. See **Songs, which are listened
   * to** under **Flashcards** in README.md.
   */

  /* What a word is, for splitting a line into presses: a run of Latin
     letters, õ, ä, ö, ü, š and ž included. tools/validate.mjs splits with the
     same class, written twice because neither can import the other, and fails
     a line with a word nobody has said the meaning of. */
  var WORD = /[A-Za-z\u00C0-\u024F]+/g;

  function songHead() {
    return el('div', { className: 'flash-deck' }, [
      el('span', { className: 'eyebrow', textContent: t('flashSongs') }),
      backOut({ song_id: state.song.id })
    ]);
  }

  /* YouTube's own player, from the address that sets no cookie until play is
     pressed. Where the video has gone or will not play, the player says so in
     its own frame and every line under it still works — nothing here waits on
     it. */
  function songVideo(song) {
    return el('div', { className: 'flash-song-video' }, [
      el('iframe', {
        src: 'https://www.youtube-nocookie.com/embed/' + encodeURIComponent(song.video) + '?rel=0',
        title: t('flashSongVideo', { name: means(song.name) }),
        allow: 'encrypted-media; picture-in-picture; fullscreen',
        allowfullscreen: true,
        referrerpolicy: 'strict-origin-when-cross-origin'
      })
    ]);
  }

  /* What one word says in its box. */
  function wordBox(song, key) {
    var word = song.words[key];
    var where = null;
    if (word.deck) {
      where = word.deck.id === (song.deck && song.deck.id)
        ? t('flashInSongDeck')
        : t('flashAlsoIn', { deck: means(word.deck.name) });
    }
    return el('div', { className: 'flash-song-gloss', role: 'note' }, [
      el('p', { className: 'flash-song-gloss-means' }, [
        el('b', { lang: 'et', textContent: key }), ' — ' + means(word.means)
      ]),
      word.base.toLowerCase() !== key
        ? el('p', { className: 'flash-song-gloss-base mono', lang: 'et', textContent: word.base })
        : null,
      word.note ? el('p', { className: 'flash-song-gloss-note', textContent: means(word.note) }) : null,
      where ? el('p', { className: 'flash-song-gloss-deck mono', textContent: where }) : null
    ]);
  }

  /* One line: the Estonian as a row of presses with the punctuation between
     them left as it is, the speaker beside it, and what it means under it. */
  function songLine(song, line) {
    var row = el('div', { className: 'flash-song-line' });
    var said = el('p', { className: 'flash-song-et', lang: 'et' });
    var at = 0;
    var found;
    WORD.lastIndex = 0;
    while ((found = WORD.exec(line.et))) {
      if (found.index > at) said.appendChild(document.createTextNode(line.et.slice(at, found.index)));
      said.appendChild(wordPress(song, row, found[0]));
      at = found.index + found[0].length;
    }
    if (at < line.et.length) said.appendChild(document.createTextNode(line.et.slice(at)));

    var speak = el('button', {
      type: 'button',
      className: 'alt flash-say flash-song-say',
      'data-say': line.et,
      'aria-pressed': 'false',
      'aria-label': t('flashSayAria', { text: line.et })
    }, [el('span', { className: 'flash-say-icon', 'aria-hidden': 'true' })]);
    speak.addEventListener('click', function () { sayIt(line.et, 'line'); });

    row.appendChild(said);
    row.appendChild(speak);
    row.appendChild(el('p', { className: 'flash-song-means', textContent: means(line) }));
    return row;
  }

  function wordPress(song, row, text) {
    var key = text.toLowerCase();
    var b = el('button', {
      type: 'button',
      className: 'flash-song-w',
      'aria-expanded': 'false',
      textContent: text
    });
    b.addEventListener('click', function () {
      var open = b.getAttribute('aria-expanded') === 'true';
      shutWord();
      if (open || !song.words[key]) return;
      b.setAttribute('aria-expanded', 'true');
      b.classList.add('is-open');
      row.appendChild(wordBox(song, key));
      TTBTrack.event('flash_song_word', { song_id: song.id, word: key });
    });
    return b;
  }

  /* Whichever box is open, shut. */
  function shutWord() {
    var boxes = main.querySelectorAll('.flash-song-gloss');
    for (var i = 0; i < boxes.length; i++) boxes[i].parentNode.removeChild(boxes[i]);
    var open = main.querySelectorAll('.flash-song-w.is-open');
    for (var j = 0; j < open.length; j++) {
      open[j].classList.remove('is-open');
      open[j].setAttribute('aria-expanded', 'false');
    }
  }

  /* Who wrote it, under the video: the words, the music, or both, whichever
     the file knows. Names, so never translated; only the word in front of
     each is. */
  function songCredit(song) {
    var credit = song.credit || {};
    var said = [];
    if (credit.words) said.push(t('flashSongWordsBy', { who: credit.words }));
    if (credit.music) said.push(t('flashSongMusicBy', { who: credit.music }));
    return said.length ? el('p', { className: 'flash-song-credit mono', textContent: said.join(' · ') }) : null;
  }

  function songCard() {
    var song = state.song;
    var kids = [
      heading(means(song.name)),
      el('p', { className: 'lists-say', textContent: t('flashSongHow') }),
      songVideo(song),
      songCredit(song)
    ];
    song.verses.forEach(function (verse, i) {
      var box = el('section', { className: 'flash-song-verse' }, [
        el('h2', { className: 'flash-song-head', textContent: t('flashVerse', { n: i + 1 }) })
      ]);
      verse.forEach(function (line) { box.appendChild(songLine(song, line)); });
      kids.push(box);
    });

    var heard = el('button', { type: 'button', className: 'go', textContent: t('flashHeardIt') });
    heard.addEventListener('click', function () {
      if (heard.disabled) return;
      heard.disabled = true;
      hearSong(song);
    });
    var acts = [heard];
    if (song.deck) {
      acts.push(TTBTrack.click(
        inPage(el('a', { className: 'alt', href: deckHref(song.deck.id), textContent: t('flashSongCards') }), song.deck.id),
        'flash_open', { deck_id: song.deck.id, own: 0 }
      ));
    }
    kids.push(foot(acts));

    var node = card(kids);
    node.classList.add('flash-song');
    return node;
  }

  /* Heard it: readLesson() again, under the songs' own deck id. */
  function hearSong(song) {
    song.heard = true;
    TTBTrack.event('flash_song_heard', { song_id: song.id });
    var back = function () { go('', true); };
    if (state.user && state.ready) {
      post(FLASH_API, { action: 'knew', deck: SONGS, card: song.id }).then(back);
    } else {
      keep(SONGS, song.id, true);
      back();
    }
  }

  /* ------------------------------------------------- where you left off
   * What this device had open, so the front door can reopen it: the deck a
   * run is going in, or the lesson being read, or the song being heard. Written on every draw and
   * cleared by the shelf, the end of a run, the gate, a shut stage and the
   * editor, so what is ever reopened is a card in hand or a page being read,
   * never a screen somebody had finished with. localStorage rather than the
   * account, because it is where this device was closed — a phone closed on
   * a deck and a laptop closed on the shelf were closed in two places — and
   * only signed in, since signed out the run is the tab's and goes with it.
   * boot() is the reader. See **Where you left off** under **Flashcards** in
   * README.md.
   */
  var LAST_KEY = 'ttb.flash.last';

  function rememberHere() {
    if (!state.user || !state.ready) return;
    var here = state.lesson ? state.lesson.id
             : state.song ? state.song.id
             : state.deck && current() && !state.gated && !state.locked && !state.editing ? state.deck.id
             : '';
    if (here) storeSet(LAST_KEY, here);
    else forgetHere();
  }

  function forgetHere() {
    try { window.localStorage.removeItem(LAST_KEY); } catch (e) { /* no store */ }
  }

  /* -------------------------------------------------------------- the deck is
   * gone, or was never there. A deck id in the address that answers with
   * nothing: somebody's own deck deleted in another tab, a shipped deck, a
   * lesson or a song that has been taken out of the file, or a link that was mistyped.
   * All of them are the same sentence and the way back to the decks.
   */
  function goneCard() {
    return card([
      el('p', { className: 'eyebrow', textContent: t('flashEyebrow') }),
      heading(t('flashGoneTitle')),
      /* Only ever a deck that is not there: a site that did not answer never
         reaches render() at all — see boot() — so this card cannot tell
         somebody their deck has gone when it was the network that dropped. */
      el('p', { className: 'lists-say', textContent: t('flashErrGone') }),
      foot([inPage(el('a', { className: 'alt', href: at(HOME), textContent: t('flashDecks') }), '')])
    ]);
  }

  /* ---------------------------------------------------------------- the page
   * One place decides what is on screen and decides it once, after every
   * answer is in.
   */
  function render() {
    clear(main);

    /* Undo is on offer only while a card of the run is on screen, so anything
       else this draws sends the answer it was holding back — flush(). */
    if (!(state.deck && !state.editing && !state.locked && !state.gated && current())) flush();

    /* The tab is part of what a link is: somebody with six tabs open should be
       able to tell which one is the Estonian. And back to the page's own name
       when the deck is closed, because closing one is no longer a page load
       and nothing else would ever put it back. */
    if (state.deck) document.title = deckName(state.deck);
    else if (state.lesson) document.title = means(state.lesson.name);
    else if (state.song) document.title = means(state.song.name);
    else document.title = t('flashDocumentTitle');

    var wrap = el('div', { className: 'lists-stack' });
    var add = function (node) { if (node) wrap.appendChild(node); };

    if (asked && !state.deck && !state.lesson && !state.song) {
      add(goneCard());
    } else if (state.lesson) {
      add(lessonHead());
      add(lessonCard());
    } else if (state.song) {
      add(songHead());
      add(songCard());
    } else if (state.deck && state.editing) {
      add(editView());
    } else if (state.deck) {
      if (state.locked) {
        add(runHead());
        add(lockedCard());
      } else if (state.gated) {
        /* The head as well as the card. It names the deck this is about, and it
           carries All the decks — which is the whole of what a gate owes
           somebody: the deck stops, the site does not. */
        add(runHead());
        add(gateCard());
      } else {
        var now = current();
        if (now) studyView(now).forEach(add);
        else {
          add(runHead());
          /* Two different empties. A run that was never built because nothing
             was due is a deck already known; a run that has been gone
             through is the end of a sitting. They say different things and
             offer different ways on. */
          add(state.run && state.run.queue.length === 0 ? restedCard() : doneCard());
          if (!state.user && state.ready) add(authCard());
        }
      }
    } else {
      add(shippedCard());
      /* The offer of an account is only drawn where an account would work.
         With the database off there is nothing behind the form but a 503, and
         the line in the card above has already said that nothing is being
         remembered. */
      if (state.user) add(yoursCard());
      else if (state.ready) add(authCard());
    }

    main.appendChild(wrap);
    rememberHere();

    /* A word still sounding whose button is no longer on screen — the card
       was answered, undone or left — stops here, and one that is still there
       gets its button drawn the way it was. */
    if (voice.text) {
      var still = false;
      var says = main.querySelectorAll('.flash-say');
      for (var i = 0; i < says.length; i++) {
        if (says[i].getAttribute('data-say') === voice.text) still = true;
      }
      if (still) paintSay();
      else hush();
    }
  }

  /* What came of a round trip to Google, said once the page has drawn and
     knows who is signed in. */
  function sayGoogle() {
    if (googleSaid === 'in') {
      if (state.user) toast(t('accountSignedIn', { name: state.user }));
    } else if (googleSaid === 'taken') {
      toast(t('accountErrGoogleTaken'));
    } else if (googleSaid === 'failed') {
      toast(t('accountErrGoogle'));
    } else {
      return;
    }

    try {
      window.history.replaceState(null, '', hereWithoutGoogle());
    } catch (e) { /* an old browser keeps the parameter, which is harmless */ }
  }

  /* ------------------------------------------------------------------- boot */

  function boot() {
    main = document.getElementById('main');
    langBar = document.getElementById('lang-switch');

    /* The mark in the header goes to the map, and where the map is depends on
       which hostname this is. The markup carries the site's own spelling, so
       the page is right when the script never runs; this is the subdomain's. */
    if (ON_SUBDOMAIN) document.getElementById('brand-home').href = MAP;

    /* And the arrows, which answer the card in hand from wherever the focus
       is. See wireKeys(). */
    wireKeys();

    applyStyle();

    /* Who is signed in, the decks, and — where the address names one — that
       deck whole with its cards, and every word this page prints, in one
       answer. /api/account is not read on the way in at all: the only thing
       this page ever wanted from it was a name to put in the sign-up field,
       and the form asks for that now rather than offering one. */
    /* Where this device left off, if the address does not say: the deck or
       the lesson or the song the front door reopens instead of the shelf — see
       rememberHere(). Asked for in the same one request. */
    var resumed = asked ? '' : (storeGet(LAST_KEY) || '');
    if (resumed) asked = resumed;

    var query = new URLSearchParams();
    query.set('lang', wanted().join(','));
    if (asked) query.set('deck', asked);

    ask(FLASH_API + '?' + query.toString()).then(function (answer) {
      /* Nothing arrived, not even the words to say so. What is left is the
         markup's own English and whatever functions/flashcard.js wrote into
         the page as text — the decks as a list of links, or one deck's words —
         which is readable and works, and better than the keys this page would
         print without a language. The map is one press away in the header. */
      if (answer.status === 0) return;

      state.lang = answer.out.lang || DEFAULT_LANG;
      state.ui = answer.out.ui || {};
      state.langs = answer.out.langs || [];
      applyStaticStrings();
      renderLanguageSwitch();
      mountRadio();
      document.title = t('flashDocumentTitle');

      /* A Google account with no account here yet: the form this page draws
         for somebody signed out becomes the one that asks for a name. Before
         settle(), which reads state.view to decide whether the gate stands. */
      if (googleSaid === 'name' && !state.user) state.view = 'google';

      /* The decks, the deck and the tab's own answers, put where they go. The
         same call go() makes for every address after this one — settle() is
         where the whole of that lives now. */
      settle(answer.out);

      /* And the back button, which is the other half of go(): the address has
         already moved by the time this arrives, so nothing is pushed. It is
         wired once the first answer is in, because there is nothing for it to
         draw until the words and the language are. */
      window.addEventListener('popstate', function () {
        go(new URLSearchParams(window.location.search).get('d') || '', false);
      });

      if (resumed && (!state.user || (!state.deck && !state.lesson && !state.song))) {
        /* A place remembered for somebody no longer signed in, or a deck, a
           lesson or a song that has gone since: the front door is the shelf after
           all, asked for a second time — rare, and the one case where this
           page makes two requests on the way in. */
        forgetHere();
        asked = '';
        go('', false);
      } else {
        if (resumed) {
          /* The address says where this is, as it would after a press, and
             the front door stays under it, so the back button leaves the deck
             rather than the site. */
          try {
            window.history.pushState(null, '', deckHref(resumed));
          } catch (e) { /* an old browser keeps the address; the page is right */ }
          TTBTrack.event('flash_resume', { deck_id: resumed });
        }
        render();
      }
      /* The tag counted this address as the document loaded, deck and all, so
         only the walks from here are go()'s to report. */
      TTBTrack.seen();
      sayGoogle();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
