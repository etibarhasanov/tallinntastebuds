/**
 * Tallinn Tastebuds — /flashcard.html, and flashcard.tallinntastebuds.ee.
 *
 * WHAT THIS PAGE IS
 *
 * A site about eating in Tallinn is read mostly by people who cannot read the
 * menu. This is the other half of that: forty-two decks of Estonian, one
 * thousand nine hundred and sixty cards, Estonian on the front and what it
 * means on the back, and one card at a time with two words under it — Knew
 * it, and Show me again.
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
 * HOW ANYBODY FINDS IT, WHICH IS ONE ROW
 *
 * Nothing in the map's chrome points here. The only link to this page on the
 * whole site is a row on /account.html, behind a sign-in, under somebody's own
 * name — the map's chrome is for finding dinner, and a deck of Estonian is
 * something you go to rather than something that should interrupt you.
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
 * SO ONE WORD IS FREE AND THE REST OF A DECK IS NOT
 *
 * Signed out, a deck is opened, its first card is turned over and answered the
 * way every card is, and then gateCard() below stands where the second card
 * would have been, until there is an account. It has no way past.
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
 * One word rather than none, because somebody shown nothing is being asked to
 * sign up for a description, and one word rather than one a deck, because a
 * free word per deck across forty-two decks is the product. It is the tab's
 * word: the run below is sessionStorage, so tomorrow is somebody arriving
 * again, and nothing here follows anybody who has not signed in.
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
 * forty-two the site ships, and yours under them. With it, it is that deck,
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
 *
 * Every other page fetches data/ui.json whole on the way in — ten languages of
 * every string the site has, 85 KB gzipped — to print its few dozen keys in
 * one of them. Here the words ride in the same answer as the decks: the page
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

  var STYLES = ['red', 'green'];
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
      /* And whether this deck is in a stage this person has not reached —
         opened by its address, or by a link somebody sent, since its row on
         the decks page is not a link while it is. Held to the same rule as
         the row: a deck with a card already known in it is one they were in
         before the stage closed behind them, and it stays open. See
         gateFor(). */
      state.locked = !!gateFor(state.deck.level) && !state.deck.cards.some(function (c) { return c.known; });
    }

    /* A deck of your own with nothing in it yet opens as the editor rather
       than as a deck. There is nothing to turn over, and anything else would
       be an empty card with a word on it telling somebody to go and find the
       way to fill it. */
    if (state.deck && state.deck.own && !state.deck.cards.length) state.editing = true;

    /* And whether the gate is already up. Two cases, and mark() has the
       ordinary third.
     *
       The tab has answered a word signed out already — `sent` is what it is
       holding, read above rather than posted — so the free word is spent, on
       this deck and on every other. Without this line the reload button, or
       the way back to the decks and in again, would be the way past the gate:
       the run rebuilds from the route's answer, which has no idea who this is,
       and the next card would be handed over for nothing. One word is one
       word, not one a deck opened.
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
        (state.view === 'google' || Object.keys(sent).length)) standGate();
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
   * read back out of here on the next load, and the account is offered one word
   * into the first deck this tab opens and again at the end of a run.
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

  /* Past this, the rest are answered again next time — the direction a failed
     write already errs in, and the harmless one.

     It is a cap on one case now, and it is worth saying which. Signed out with
     the database bound, the gate stops a run at one word, so this holds one
     answer and never comes near the number. What fills it is the database
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

  function post(url, payload) {
    return fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload)
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
    document.documentElement.style.colorScheme = style === 'green' ? 'dark' : 'light';

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

  function markLangMenu(open) {
    if (!langBar) return;
    langBar.classList.toggle('is-open', open);
    var now = langBar.querySelector('.btn-lang-now');
    if (now) now.setAttribute('aria-expanded', String(open));
  }

  function closeLangMenu() { markLangMenu(false); }

  function renderLanguageSwitch() {
    if (!langBar) return;
    clear(langBar);
    /* Nothing to choose between. Either the route could not read
       data/ui.json — in which case this page has no words either and is
       drawing the markup's own English — or the site speaks one language, and
       a switch with one row in it is a button that does nothing. */
    if (!state.langs || state.langs.length < 2) return;

    var now = el('button', {
      type: 'button',
      className: 'btn btn-lang-now',
      'aria-expanded': 'false',
      'aria-label': t('language')
    }, [
      el('span', { textContent: state.lang.toUpperCase() }),
      el('span', {
        className: 'caret',
        html: '<svg viewBox="0 0 10 6" aria-hidden="true" focusable="false"><path d="M1 1l4 4 4-4"/></svg>'
      })
    ]);
    now.addEventListener('click', function () {
      var open = !langBar.classList.contains('is-open');
      markLangMenu(open);
      if (open) TTBTrack.event('language_open');
    });
    langBar.appendChild(now);

    var list = el('div', { className: 'lang-list' });
    state.langs.forEach(function (lang) {
      var btn = el('button', {
        type: 'button',
        className: 'btn btn-lang',
        lang: lang.code,
        'aria-label': lang.name,
        'aria-pressed': String(lang.code === state.lang)
      }, [
        el('span', { className: 'lang-code', textContent: lang.code.toUpperCase() }),
        el('span', { className: 'lang-name', textContent: lang.name })
      ]);
      btn.addEventListener('click', function () { pickLanguage(lang.code); });
      list.appendChild(btn);
    });
    langBar.appendChild(list);
  }

  function pickLanguage(code) {
    closeLangMenu();
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
          complain(form, say(a.out));
          return;
        }
        TTBTrack.event(naming || creating ? 'account_create' : 'account_login',
                       { via: naming ? 'google' : 'flashcard' });
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

  /* The gate. One word of a deck is turned over and answered signed out, and
     then this stands where the second card would have been, until there is an
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
     One word rather than none, and that is deliberate: somebody who has been
     shown nothing is being asked to sign up for a description. The word is the
     sample, it is a real card answered in the real way, and keep() above has
     written that answer into the tab, so the one thing already done comes with
     them when they make the account. That last part is why the copy can promise
     it.
   *
     The way out of a deck is not on this card and does not need to be: All the
     decks stands in the head above, where it stands on every view of a deck,
     and the whole of the decks page is still open signed out. What is behind
     the gate is the second word of a deck, not the site. */
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
   * The three levels are stages, and the second and third open on how many
   * words this person knows: `gates` off the route says at what, `words` says
   * how many, and both are the route's to compute — the page prints them and
   * never decides them, so there is one copy of the numbers.
   *
   * What a stage that has not opened looks like is the same rows, readable,
   * with a line under the heading saying what opens it; nothing is hidden and
   * nothing is collapsed, which keeps the promise the sort under standing()
   * makes. What changes is that a row in it is not a link.
   *
   * Signed out nothing is held: there is no count for somebody the site has
   * never met, and the one-word gate under mark() already stands in front of
   * every deck. With the database off, likewise — the same condition the row
   * draws its count under. A deck of your own and the deck of what you got
   * wrong are in no stage, which the route says by giving them no level, so
   * there is nothing here to look up for them. And a deck with a card already
   * known in it stays open whatever its stage says, because the stages
   * arrived after the decks did and somebody halfway through Going deeper is
   * not to find it shut.
   */
  function gateFor(level) {
    if (!(state.user && state.ready)) return 0;
    var gate = state.gates[level] || 0;
    return gate > state.words ? gate : 0;
  }

  /* A row on the decks page, where `known` is a count rather than the cards. */
  function locked(deck) {
    return !deck.known && gateFor(deck.level) > 0;
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

  /* Every deck has a name and a line under it, and one of them has neither in
     the data: the missed deck is assembled per request and its words belong to
     the interface rather than to the content — so they are in data/ui.json,
     where every other word on this page is, in all ten that file speaks even
     though this page only ever prints three of them. The rest come out of
     data/decks.json in the three the decks are written in, which is what
     means() picks between. */
  function deckName(deck) {
    return deck.missed ? t('flashMissedName') : means(deck.name);
  }

  function deckWhy(deck) {
    return deck.missed ? t('flashMissedWhy') : (means(deck.why) || null);
  }

  function deckRow(deck) {
    /* One number on the end of a row, and which one depends on whether there
       is anything to do: "6 due" is a reason to open a deck, and "9 / 22" is a
       fact about one. Signed out neither applies and it is the size of the
       deck, which is the only thing true for everybody. */
    var said = !(state.user && state.ready) ? t('flashCards', { n: deck.cards })
             : deck.due ? t('flashDue', { n: deck.due })
             : t('flashKnownOf', { known: deck.known, n: deck.cards });

    var why = deckWhy(deck);

    /* A row in a stage this person has not reached is the same row, minus the
       link and the chevron that says it opens, and its count is the deck's
       size — the one number about it that is true whatever the stage says.
       The line under the stage's heading says what opens it, once, rather than
       every row repeating the same number. */
    if (locked(deck)) {
      return el('li', { className: 'menu-item' }, [
        el('div', { className: 'menu-row is-locked' }, [
          el('span', { className: 'menu-say' }, [
            el('span', { className: 'menu-name', textContent: deckName(deck) }),
            el('span', { className: why ? 'flash-why' : 'menu-why',
                         textContent: why || t('flashCards', { n: deck.cards }) })
          ]),
          why ? el('span', { className: 'lists-count mono', textContent: t('flashCards', { n: deck.cards }) }) : null
        ])
      ]);
    }

    return el('li', { className: 'menu-item' }, [
      TTBTrack.click(
        inPage(el('a', { className: 'menu-row', href: deckHref(deck.id) }, [
          el('span', { className: 'menu-say' }, [
            el('span', { className: 'menu-name', textContent: deckName(deck) }),
            /* What the deck is, in the body face, because it is a sentence of
               prose — .flash-why in assets/flashcard.css carries the argument
               and the design rule behind it. The count standing in its place
               on a deck nobody wrote a line for is a label rather than a
               sentence, so that one keeps .menu-why's mono. */
            el('span', { className: why ? 'flash-why' : 'menu-why',
                         textContent: why || said })
          ]),
          /* .mono, like every other count on this site: the lists page's and
             the account page's both ask for it at the call site, and this row
             was the one that had been drawing its number in the body face. */
          why ? el('span', { className: 'lists-count mono', textContent: said }) : null,
          el('span', { className: 'menu-go', 'aria-hidden': 'true',
                       html: '<svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg>' })
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
       3  resting               everything known, and none of it come round
                                again yet

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
     they are what draws "6 due" against "22 / 22" on the end of it. A press
     would have wanted somewhere to keep the answer, and it would have fought
     the spacing besides: a deck is never finished here, only resting, and one
     put at the bottom by hand would still be at the bottom on the morning its
     cards came round again. Sinking by what is due rises again on its own.

     Sorted and not filtered. Every deck is still a row, still opens, and still
     offers Go through it anyway — a deck somebody wants to sit and read is not
     to be hidden because the spacing has nothing to say today. And stable, so
     inside a rung the order is the one it arrived in: the file's for the decks
     the site ships, most-recently-edited-first for the ones somebody wrote.

     Signed out, and with the database off, there is nothing to sort by. Every
     row says how many cards it holds, none of them says what is due, and the
     order stays the file's — the same line deckRow() draws its count under. */
  function deckList(decks) {
    var ul = el('ul', { className: 'menu' });
    var order = (state.user && state.ready)
      ? decks.slice().sort(function (a, b) { return standing(a) - standing(b); })
      : decks;
    order.forEach(function (deck) { ul.appendChild(deckRow(deck)); });
    return ul;
  }

  /* The levels, in the order somebody meets them, and the string that names
     each. A deck with no level falls to the end under no heading at all, which
     is where the missed deck would go if it were not lifted out above. */
  var LEVELS = [
    { id: 'start', key: 'flashLevelStart' },
    { id: 'more', key: 'flashLevelMore' },
    { id: 'deep', key: 'flashLevelDeep' }
  ];

  /* The decks the site ships, and the sentence saying what this page is for.
     The one somebody got wrong goes at the top, above the headings: it is the
     most useful thing on the page and the only part of it they did not
     choose. */
  function shippedCard() {
    var ours = state.decks.filter(function (d) { return !d.own && !d.missed; });
    var missed = state.decks.filter(function (d) { return d.missed; });

    var kids = [
      el('p', { className: 'eyebrow', textContent: t('flashEyebrow') }),
      heading(t('flashTitle')),
      el('p', { className: 'lists-say', textContent: t('flashWhat') }),
      /* Said once, quietly, and only where it is true: the database is not
         bound or this deployment is holding the other half's. Every deck below
         still turns over — they are a file — so this is a line rather than the
         page refusing to draw. */
      state.ready ? null : el('p', { className: 'lists-say', textContent: t('flashErrOff') })
    ];

    if (missed.length) kids.push(deckList(missed));

    if (!ours.length) {
      kids.push(el('p', { className: 'lists-none', textContent: t('flashNoneShipped') }));
      return card(kids);
    }

    /* Grouped by level, with the quiet heading the directory puts over a run
       of rows. Forty-two decks in one column was a list to scroll; three short
       under headings is a choice about where you are. A level with nothing in
       it draws no heading — the headings are for the decks, not the other way
       round. */
    LEVELS.forEach(function (level) {
      var these = ours.filter(function (d) { return d.level === level.id; });
      if (!these.length) return;
      kids.push(el('h2', { className: 'lists-section', textContent: t(level.key) }));
      /* What this stage opens at and how far off that is, under the heading
         and once, where the stage is still shut. */
      var gate = gateFor(level.id);
      if (gate) {
        kids.push(el('p', { className: 'flash-opens mono',
                            textContent: t('flashOpens', { n: gate, left: gate - state.words }) }));
      }
      kids.push(deckList(these));
    });

    var loose = ours.filter(function (d) {
      return !LEVELS.some(function (l) { return l.id === d.level; });
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
   * What goes in it is what is **due**: everything never answered, plus
   * everything whose box has come round again. The boxes are the server's —
   * BOXES in functions/api/flashcard.js — and this page never computes a date;
   * it is told per card whether that card is due and puts the due ones in.
   * The ones you have never got right come first, so a deck opened after a
   * fortnight away starts with what is new rather than with a revision.
   *
   * `all` is the way past it: Go through it again at the end of a run, and Go
   * through it anyway on a deck with nothing waiting, both build a run of the
   * whole deck. The spacing is what the page does when you do not ask;
   * somebody who wants to sit and read their own deck is not to be told to
   * come back on Thursday.
   *
   * Pressing Show me again still puts the card back on the end of the run, so
   * it comes round once more before the deck is finished — and, on the server,
   * drops it into box nought, due now, so it is in the next run from the
   * beginning too and in the deck of what you got wrong.
   *
   * `back` is which cards have had that second turn, because it is one turn
   * and not an unlimited supply. See mark().
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
       at all is due. That is the same direction the route errs in when the two
       spacing columns are missing — see readingBoxes() there — and it is the
       safe one, because a card wrongly called due is a card asked twice, and a
       card wrongly called resting is a card that silently leaves the deck. */
    cards.forEach(function (c) { if ((all || c.due !== false) && !c.known) queue.push(c); });
    cards.forEach(function (c) { if ((all || c.due !== false) && c.known) queue.push(c); });
    state.run = { queue: queue, at: 0, turned: false, back: {} };
  }

  /* Which deck a card is really from, which is only ever different in the
     missed deck: that one is assembled out of rows belonging to other decks,
     and everything said about a card there — the write, and the note that it
     has had its second turn — has to name the deck it came from rather than
     the one it is being shown in. */
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
      face: state.run.turned ? 'back' : 'front'
    });

    if (state.user && state.ready) {
      post(FLASH_API, { action: knew ? 'knew' : 'again', deck: from(word), card: word.id });
    } else {
      /* Nobody to tell yet, so it is written down for whoever signs in from
         the card at the end of this run — see keep() above. */
      keep(from(word), word.id, knew);
    }

    /* Back on the end of the run, and once only.
     *
       It used to be every time, and a run of a deck somebody was struggling
       with then had no end: three cards answered wrong put three more on a
       queue that was already growing, the bar under the card filled towards a
       total that moved away from it, and the only way to leave was the way
       back to the decks. A second look is the point — it is the one the
       README promises — and a third in the same sitting is not learning, it is
       the page refusing to let go.

       Nothing is lost by stopping there. The card is in box nought on the
       server, so it is due at the top of the next run of this deck and it is
       in the deck of what you got wrong, which is where looking again
       belongs. */
    var again = from(word) + '/' + word.id;
    if (!knew && !state.run.back[again]) {
      state.run.back[again] = true;
      state.run.queue.push(word);
    }

    state.run.at += 1;
    state.run.turned = false;

    /* And this is where the gate goes up, signed out: on the answer, in the
       place the next card would have been.
     *
       On the answer rather than on the turn, because the two words under a
       turned card are the question the page asked, and taking them away before
       they are pressed is asking something and then not listening. The word is
       finished, properly, and then the deck stops. See gateCard().
     *
       `current()` because a deck with nothing left has nothing to gate: the end
       of a run says its own thing and carries the same offer already. */
    if (!state.user && state.ready && current()) standGate();

    render();
    focusRun();
  }

  /* The card itself. A <button>, so the thumb, the keyboard and the screen
     reader all get the same thing — see .flash-card in assets/flashcard.css
     for why the whole card is the target and not a word on it. */
  function faceCard(word) {
    var turned = state.run.turned;
    var face = el('div', { className: 'flash-face' }, turned
      ? [
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
          ]) : null,
          el('p', { className: 'flash-turn', textContent: t('flashTurned') })
        ]
      : [
          el('p', { className: 'flash-front', textContent: word.front }),
          el('p', { className: 'flash-turn', textContent: t('flashTurn') })
        ]);

    /* The word the card is heading for while it is being dragged. Drawn
       empty and filled by the drag, so nothing is built mid-gesture, and it
       says the answer in words rather than in a tint alone — design rule 10,
       and the reason there is no green card and red card here. */
    var verdict = el('p', { className: 'flash-verdict', 'aria-hidden': 'true' });

    /* No aria-live on it, and that is deliberate rather than an omission. It
       carried one, on a node render() replaces whole every time anything is
       pressed — which is the one arrangement a live region does not reliably
       announce, and where it does work it says the same thing taking the focus
       is about to say, twice. focusRun() below is what took over the job. */
    var node = el('button', { type: 'button', className: 'flash-card' }, [verdict, face]);

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
      if (dragged()) return;
      state.run.turned = !state.run.turned;
      render();
      focusRun();
    });

    return node;
  }

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
    }

    function rest() {
      node.classList.remove('is-dragging');
      node.style.transform = '';
      verdict.style.opacity = '0';
    }

    node.addEventListener('pointerdown', function (ev) {
      if (ev.button !== undefined && ev.button !== 0) return;
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
        /* Answered. The card is left where the finger put it and the next one
           is drawn over it by render() — no fly-out, because the movement
           under the thumb has already said what happened and this site's one
           motion idea is things settling into place rather than leaving it. */
        mark(word, dx > 0, 'swipe');
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
    document.addEventListener('keydown', function (ev) {
      if (ev.key !== 'ArrowLeft' && ev.key !== 'ArrowRight') return;

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
         the press anywhere else is under, a few lines down in boot(). */
      if (langBar && langBar.classList.contains('is-open')) return;

      /* Only where a card is really on screen, which is the condition
         render() draws one under. The run outlives the two views that are not
         it — the editor, and the gate — so current() still has a word in hand
         on both, and answering it there would spend a card of a deck from a
         page that is showing a form. */
      if (!state.deck || state.editing || state.gated) return;
      var word = current();
      if (!word) return;

      /* Left to itself an arrow scrolls the page sideways, which on a phone-
         width window is the card leaving. */
      ev.preventDefault();
      mark(word, ev.key === 'ArrowRight', 'key');
    });
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

  /* The eyebrow over the card: which deck this is, the way back out of it, and
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
      backOut()
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
    /* Nothing under the card until it has been turned. Drawing Knew it against
       a word whose meaning nobody has seen yet would be inviting a press that
       cannot mean anything — and the way out of the deck is in the head above,
       where it stands whichever face is up. The card itself is the exception:
       it can be thrown from the front, and the header of swipe() says why a
       throw is not the invitation a drawn button would be. */
    if (!state.run.turned) return [runHead(), faceCard(word), runBar()];

    var acts = el('div', { className: 'flash-acts' });

    var again = el('button', { type: 'button', className: 'alt', textContent: t('flashAgain') });
    again.addEventListener('click', function () { mark(word, false, 'press'); });
    acts.appendChild(again);

    var knew = el('button', { type: 'button', className: 'go', textContent: t('flashKnew') });
    knew.addEventListener('click', function () { mark(word, true, 'press'); });
    acts.appendChild(knew);

    return [runHead(), faceCard(word), runBar(), acts, wrongLine(word)];
  }

  /* --------------------------------------------------- this card is wrong
   * Under the two answers rather than beside them. The row above says what to
   * do with the word and this says what to do about the card, which is a
   * different question and a much rarer one — and a third control in that row
   * would make the page look like it was asking three things at once.
   *
   * Only on a deck the site ships. A deck you wrote has an editor with a
   * Remove on every row, so reporting your own words to me would be a loop,
   * and the missed deck is somebody's own rows about cards that are all
   * reportable in the deck they came from.
   *
   * The Estonian here is mine and has not been read by anybody who grew up
   * with the language. The people turning these over are the only proofreaders
   * it has. See **This card is wrong** under **Flashcards** in README.md.
   */
  function wrongLine(word) {
    if (state.deck.own || state.deck.missed) return null;

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

  function backOut() {
    return TTBTrack.click(
      inPage(el('a', { className: 'alt', href: at(HOME), textContent: t('flashDecks') }), ''),
      'flash_back', { deck_id: state.deck.id }
    );
  }

  /* ------------------------------------------------------------ the end of it */

  /* A deck with nothing waiting: everything in it has been answered right and
     none of it has come round again yet. It is not the end-of-run card — there
     was no run — and it is not an error, it is the spacing working. The way
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
       every card in it at once, wherever the card came from. */
    if (state.user && state.ready && (mine > 0 || state.deck.missed)) {
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

  /* -------------------------------------------------------------- the deck is
   * gone, or was never there. A deck id in the address that answers with
   * nothing: somebody's own deck deleted in another tab, a shipped deck that
   * has been taken out of the file, or a link that was mistyped. All three are
   * the same sentence and the way back to the decks.
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

    /* The tab is part of what a link is: somebody with six tabs open should be
       able to tell which one is the Estonian. And back to the page's own name
       when the deck is closed, because closing one is no longer a page load
       and nothing else would ever put it back. */
    if (state.deck) document.title = deckName(state.deck);
    else document.title = t('flashDocumentTitle');

    var wrap = el('div', { className: 'lists-stack' });
    var add = function (node) { if (node) wrap.appendChild(node); };

    if (asked && !state.deck) {
      add(goneCard());
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
             was due is the spacing doing its job; a run that has been gone
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

    /* The menu shuts on a press anywhere else, which is the map's own rule and
       the only thing on this page listening on the document. A press on the
       switch itself is inside it and leaves it alone. */
    document.addEventListener('click', function (ev) {
      if (langBar && !langBar.contains(ev.target)) closeLangMenu();
    });
    /* And on Escape, with the focus handed back to the button it dropped from
       — a keyboard that closes a menu and is left standing in nothing has been
       put somewhere it cannot see. */
    document.addEventListener('keydown', function (ev) {
      if (ev.key !== 'Escape' || !langBar || !langBar.classList.contains('is-open')) return;
      var now = langBar.querySelector('.btn-lang-now');
      if (langBar.contains(document.activeElement) && now) now.focus();
      closeLangMenu();
    });

    /* And the arrows, which answer the card in hand from wherever the focus
       is. See wireKeys(). */
    wireKeys();

    applyStyle();

    /* Who is signed in, the decks, and — where the address names one — that
       deck whole with its cards, and every word this page prints, in one
       answer. /api/account is not read on the way in at all: the only thing
       this page ever wanted from it was a name to put in the sign-up field,
       and the form asks for that now rather than offering one. */
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

      render();
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
