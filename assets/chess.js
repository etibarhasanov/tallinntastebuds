/**
 * Tallinn Tastebuds — /chess.html, one chessboard for the whole city.
 *
 * WHAT THIS PAGE IS
 *
 * A board that is always on the page: Everybody against Tallinn Tastebuds.
 * Whoever is here when it is Everybody's turn may play the next move, signed
 * in or not, and the house — the owner's account — answers when it gets to the
 * board, from this same page, which shows it a different face. Beside it, a
 * waiting list: a member joins it, the house starts a game with the first in
 * line, one at a time, and that game is drawn on the same board component
 * with the member's name where Everybody's was. **Chess** in README.md is the
 * whole of the feature and .claude/skills/chess/SKILL.md is the shape that was
 * agreed before any of it was written, the three faces and the order each
 * puts the cards in included — cards() below is that table.
 *
 * THE BROWSER RUNS NONE OF THE RULES
 *
 * The route answers with every move the reader may make now — `legal`, only
 * when it is their turn — and this page draws exactly those: a press on a piece
 * that appears in one of them picks it up, a press on a square one of them goes
 * to puts it there. Nothing here knows how a knight moves, and that is the
 * point: the rules are in functions/api/_chess.js and are held to published
 * move counts by tools/chessperf.mjs, and a second copy of them in ES5 would
 * be a second thing that could be wrong without anybody noticing.
 *
 * THE ANSWER IS THE BOARD
 *
 * Every move is sent with the ply the page read — how many half-moves had
 * been played — and the route files the move one past it. If somebody got
 * there first the route says 409 and carries the board as it now is, and the
 * page redraws from that, never from what it sent. The same goes for every
 * other answer, the other writes and the poll included: nothing on this page
 * keeps a board of its own beyond the square somebody has picked up, and that
 * is dropped the moment the game it was picked in has moved on. It is also how
 * a member hears that the house has started their game — on the next poll,
 * with no reload, since the site has no address to tell them at.
 *
 * ONE REQUEST ON THE WAY IN, AND A POLL
 *
 * The page fetches nothing but /api/chess. The first ask carries `lang=` and
 * comes back with the words and the codes the switch is drawn from, the way
 * /api/flashcard's does; picking a language asks again, without reloading, so
 * a game somebody is halfway through thinking about is still on the board. A
 * poll every twenty seconds asks for the board alone, only while the page is
 * on screen, and asks at once when it comes back on screen — a tab left open
 * all night is not a request every twenty seconds until morning.
 *
 * TAKING A MOVE BACK
 *
 * For ten seconds after a move, the tab that made it shows Undo with the
 * seconds left, counting down; the route takes it back only from whoever the
 * move was filed under, only while it is still the last move and the game is
 * still on. A move that ended the game is final, so its answer never offers
 * one. state.undo is the one thing this page remembers about a move after
 * the answer, and it goes the moment the board has moved on.
 *
 * THE PIECES
 *
 * The platform's own chess glyphs, U+2654 to U+265F, each followed by U+FE0E so
 * the black pawn stays a piece rather than an emoji on the phones that have one
 * for it. They are drawn out of --pieces in assets/chess.css, coloured by
 * --ink, and on the dark style the filled glyph reads as the light side: the
 * words above the board always say who is who. No dragging, and no
 * touch-action on the board — a press is all it listens for, so a thumb that
 * starts on the board can still scroll the page.
 */
(function () {
  'use strict';

  var API = '/api/chess';

  /* The same two keys the map writes and every other page reads. Walking from
     the map to here should not feel like leaving. */
  var STYLE_KEY = 'ttb.style';
  var LANG_KEY = 'ttb.lang';

  var STYLES = ['red', 'green'];
  var DEFAULT_STYLE = 'red';
  var DEFAULT_LANG = 'en';

  /* How often the board is asked for again while the page is on screen. */
  var POLL_MS = 20000;

  /* How long a move may be taken back, counted from when it came back. The
     route allows a few seconds more, for the request on its way. */
  var UNDO_MS = 10000;

  var FILES = 'abcdefgh';

  var GLYPH = {
    K: '♔', Q: '♕', R: '♖', B: '♗', N: '♘', P: '♙',
    k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟'
  };
  /* Text presentation, so the black pawn is never the emoji. */
  var TEXT = '︎';

  /* The six names, spelled out here as literals so that tools/validate.mjs can
     see every one — a key built as 'chess' + piece is invisible to it, and a
     language missing one would fail on a phone rather than in CI. */
  var PIECE_NAME = {
    k: 'chessKing', q: 'chessQueen', r: 'chessRook',
    b: 'chessBishop', n: 'chessKnight', p: 'chessPawn'
  };
  var PROMOTE = ['q', 'r', 'b', 'n'];

  var state = {
    ui: {},
    lang: DEFAULT_LANG,
    langs: [],
    answer: null,
    /* Where the answer last drawn came from, so a poll that found nothing
       new does not throw away the square somebody is halfway through
       picking. */
    drawn: '',
    picked: null,       /* { game, ply, sq } */
    promoting: null,    /* { game, ply, from, to } */
    /* The move this tab made last and may still take back. Only the tab
       that moved knows it, which is the point: on Everybody's board the one
       who played the move is the one who may undo it, and the route checks
       the same by what the move was filed under. */
    undo: null,         /* { game, ply, until } */
    busy: false
  };

  var stack = null;
  var offline = null;
  var record = null;
  var pollTimer = null;
  var undoTimer = null;

  /* ------------------------------------------------------------ the pieces */

  function el(tag, props, kids) {
    var node = document.createElement(tag);
    if (props) {
      Object.keys(props).forEach(function (k) {
        var v = props[k];
        if (v === null || v === undefined || v === false) return;
        if (k === 'className') node.className = v;
        else if (k === 'textContent') node.textContent = v;
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

  var toastTimer = null;
  function toast(message) {
    var node = document.getElementById('toast');
    node.textContent = message;
    node.hidden = false;
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { node.hidden = true; }, 3800);
  }

  /* Every touch of localStorage is inside try/catch: it throws outright in
     some private-browsing modes, and the page is meant to work with it absent. */
  function storeGet(key) {
    try { return window.localStorage.getItem(key); } catch (e) { return null; }
  }

  function storeSet(key, value) {
    try { window.localStorage.setItem(key, value); } catch (e) { /* private mode */ }
  }

  /* Asked so that "the site did not answer" (status 0) and "the site answered
     no" stay apart, the way assets/flashcard.js asks. */
  function ask(url) {
    return fetch(url, { headers: { accept: 'application/json' }, cache: 'no-store' })
      .then(function (res) {
        return res.json().catch(function () { return {}; }).then(function (out) {
          return { status: res.status, ok: res.ok, out: out || {} };
        });
      })
      .catch(function () { return { status: 0, ok: false, out: {} }; });
  }

  function post(payload) {
    return fetch(API, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload)
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (out) {
        return { status: res.status, ok: res.ok, out: out || {} };
      });
    }).catch(function () { return { status: 0, ok: false, out: {} }; });
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

  /* What the route would pick a language from, in the order every other page
     picks: ?lang=, then the choice the map stored, then the browser's own. The
     picking itself is wordsFor() in functions/api/_lib.js, so this is the
     candidates, sent as they are. Anything past ten is noise. */
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

    document.title = t('chessDocumentTitle');
    var desc = document.querySelector('meta[name="description"]');
    if (desc) desc.setAttribute('content', t('chessMetaDescription'));
  }

  /* Whether the words this page has are the route's or only the markup's own
     English: with no answer at all there is nothing to translate with, and
     t() would print keys. Nothing calls it then. */
  function haveWords() {
    return Object.keys(state.ui).length > 0;
  }

  function drawSwitch() {
    window.TTBLanguage.mount(document.getElementById('lang-switch'),
      state.langs, state.lang, pickLanguage, t('language'));
  }

  function pickLanguage(code) {
    if (code === state.lang) return;
    window.TTBTrack.event('language_select', { language: code });

    /* Three things have to hear it and only one of them is this tab: the
       store, which is what the next visit and the map read; the address, so a
       link copied from here opens in it; and the route, where the words are. */
    storeSet(LANG_KEY, code);
    var params = new URLSearchParams(window.location.search);
    params.set('lang', code);
    try {
      window.history.replaceState(null, '', window.location.pathname + '?' + params.toString());
    } catch (e) { /* an old browser keeps the address */ }

    ask(API + '?lang=' + encodeURIComponent(code)).then(function (answer) {
      /* The site did not answer, or answered without words. The page stays in
         the language it is in and says so in that language: the one thing it
         must not do is start printing its own keys because somebody pressed a
         language. The choice is stored and in the address for the next load. */
      var words = answer.out.ui;
      if (!words || !Object.keys(words).length) {
        if (haveWords()) toast(t('chessMoveFailed'));
        return;
      }
      state.lang = answer.out.lang || code;
      state.ui = words;
      if (answer.out.langs && answer.out.langs.length) state.langs = answer.out.langs;
      window.TTBRadio.language(state.lang);
      applyStaticStrings();
      drawSwitch();
      take(answer.out, true);
    });
  }

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

  /* ------------------------------------------------------------------ time */

  /* "3 min", "2 h", "4 d": how long, with the unit a word of its own in each
     language. Never under a minute, since "started just now ago" is not a
     sentence in any of the ten. */
  function span(at) {
    var m = Math.max(1, Math.floor((Date.now() - at) / 60000));
    if (m < 60) return t('chessMin', { n: m });
    var h = Math.floor(m / 60);
    if (h < 24) return t('chessHours', { n: h });
    return t('chessDays', { n: Math.floor(h / 24) });
  }

  /* "just now", "3 min ago" — "ago" wraps the unit, since where the word goes
     is a language's to say. */
  function ago(at) {
    if (Date.now() - at < 60000) return t('chessJustNow');
    return t('chessAgo', { when: span(at) });
  }

  /* ---------------------------------------------------------------- names */

  /* The names a side or a mover goes by, as the page prints them. A member
     whose account has since gone comes back as null and reads as a visitor. */
  function sideName(who) {
    if (who === 'everybody') return t('chessEverybody');
    if (who === 'house') return t('wordmark');
    return who || t('chessVisitor');
  }

  function moverName(by) {
    if (by === 'house') return t('wordmark');
    if (by === 'visitor') return t('chessVisitor');
    var you = state.answer && state.answer.you;
    return you && you.name && you.name === by ? t('chessYou') : by;
  }

  /* Whoever plays the house in this game: Everybody, or the member. */
  function otherSide(game) {
    return game.white === 'house' ? game.black : game.white;
  }

  function gameTitle(game) {
    return t('chessGameOf', { a: sideName(otherSide(game)), b: t('wordmark') });
  }

  /* ----------------------------------------------------------------- board */

  /* The pieces off the first field of a FEN, as { 'e4': 'P' }. */
  function parseFen(fen) {
    var rows = String(fen).split(' ')[0].split('/');
    var out = {};
    for (var r = 0; r < 8; r++) {
      var f = 0;
      for (var i = 0; i < rows[r].length; i++) {
        var c = rows[r].charAt(i);
        if (c >= '1' && c <= '8') f += +c;
        else { out[FILES.charAt(f) + (8 - r)] = c; f++; }
      }
    }
    return out;
  }

  function startsOf(legal) {
    var out = [];
    legal.forEach(function (u) {
      var from = u.slice(0, 2);
      if (out.indexOf(from) === -1) out.push(from);
    });
    return out;
  }

  function targetsOf(legal, from) {
    var out = [];
    legal.forEach(function (u) {
      if (u.slice(0, 2) !== from) return;
      var to = u.slice(2, 4);
      if (out.indexOf(to) === -1) out.push(to);
    });
    return out;
  }

  /* One board. `view` says which way up, which squares are pressable and what
     is picked; nothing in it is a rule. */
  function boardNode(view) {
    var pieces = parseFen(view.game.fen);
    var ranks = [8, 7, 6, 5, 4, 3, 2, 1];
    var files = FILES.split('');
    if (view.flip) { ranks.reverse(); files.reverse(); }

    var node = el('div', { className: 'chess-board', role: 'group', 'data-game': view.game.id });
    var live = !!view.legal;
    var starts = live ? startsOf(view.legal) : [];
    var targets = live && view.picked ? targetsOf(view.legal, view.picked) : [];

    ranks.forEach(function (rank) {
      files.forEach(function (file) {
        var name = file + rank;
        var piece = pieces[name];
        var pressable = live && (starts.indexOf(name) !== -1 || targets.indexOf(name) !== -1);
        var cls = 'sq';
        if ((FILES.indexOf(file) + rank) % 2 === 0) cls += ' is-dark';
        if (piece) cls += ' has-pc';
        if (view.picked === name) cls += ' is-sel';
        if (targets.indexOf(name) !== -1) cls += ' can';
        if (view.last.indexOf(name) !== -1) cls += ' is-last';
        if (view.checked === name) cls += ' is-check';

        var label = piece
          ? t('chessSquare', {
              colour: t(piece === piece.toUpperCase() ? 'chessWhite' : 'chessBlack'),
              piece: t(PIECE_NAME[piece.toLowerCase()]),
              square: name
            })
          : name + ' ' + t('chessEmpty');

        var kids = [];
        if (piece) {
          kids.push(el('span', { className: 'pc', 'aria-hidden': 'true', textContent: GLYPH[piece] + TEXT }));
        }
        /* Coordinates in the two edge squares only, the way a printed board
           has them: the rank up the left, the file along the bottom. */
        if (file === files[0]) kids.push(el('span', { className: 'co co-rank', 'aria-hidden': 'true', textContent: String(rank) }));
        if (rank === ranks[7]) kids.push(el('span', { className: 'co co-file', 'aria-hidden': 'true', textContent: file }));

        var btn = el('button', {
          type: 'button',
          className: cls,
          'data-sq': name,
          'aria-label': label,
          'aria-pressed': live && starts.indexOf(name) !== -1 ? String(view.picked === name) : null,
          disabled: !live,
          tabindex: live && !pressable ? '-1' : null
        }, kids);
        if (live) btn.addEventListener('click', function () { press(view.game.id, name); });
        node.appendChild(btn);
      });
    });
    return node;
  }

  /* ------------------------------------------------------- pressing a square */

  /* The game with this id in the answer as it now is — the public one or the
     reader's own — or null once it is neither. */
  function gameOf(id) {
    var a = state.answer;
    if (!a) return null;
    if (a.public && a.public.game.id === id) return a.public;
    if (a.mine && a.mine.game.id === id) return a.mine;
    return null;
  }

  /* What is picked on this game's board, if it was picked at the ply the
     board is at now. */
  function pickedOn(game) {
    var p = state.picked;
    return p && p.game === game.id && p.ply === game.ply ? p.sq : null;
  }

  /* A press picks a piece up, a second press on one of its dots puts it
     there, and a press anywhere else puts it back. The dots are only ever the
     squares some legal move of that piece ends on. The house may have two
     live boards at once; a pick is on one of them, and a press on the other
     starts over there. */
  function press(id, sq) {
    var g = gameOf(id);
    if (!g || !g.legal || state.busy) return;

    var picked = pickedOn(g.game);
    state.promoting = null;

    if (picked && targetsOf(g.legal, picked).indexOf(sq) !== -1) {
      var options = g.legal.filter(function (u) { return u.slice(0, 4) === picked + sq; });
      if (options.length > 1 || options[0].length === 5) {
        /* A pawn reaching the last rank: four choices where the sentence was. */
        state.promoting = { game: g.game.id, ply: g.game.ply, from: picked, to: sq };
        draw();
        return;
      }
      send(g, options[0]);
      return;
    }

    if (startsOf(g.legal).indexOf(sq) !== -1 && sq !== picked) {
      state.picked = { game: g.game.id, ply: g.game.ply, sq: sq };
    } else {
      state.picked = null;
    }
    draw();
  }

  function promote(piece) {
    var p = state.promoting;
    var g = p && gameOf(p.game);
    if (!g || g.game.ply !== p.ply || state.busy) return;
    send(g, p.from + p.to + piece);
  }

  /* The move. What comes back is drawn whatever it was: a 409 carries the
     board as it now is, and so does anything else the route refused after
     reading it. */
  function send(g, uci) {
    state.picked = null;
    state.promoting = null;

    var body = { action: 'move', game: g.game.id, ply: g.game.ply, move: uci };
    var you = state.answer.you;
    if (!you || you.role === 'visitor') body.client = window.TTBDevice.id();

    window.TTBTrack.event('chess_move', { kind: g.game.kind, ply: g.game.ply + 1 });
    write(body, { 409: 'chessGotThereFirst' }, function (out) {
      /* The move went in. It may be taken back while the game is still on —
         a move that ended it is final — so the answer is asked, not assumed. */
      var now = out.public && out.public.game.id === g.game.id ? out.public
              : out.mine && out.mine.game.id === g.game.id ? out.mine : null;
      if (now && now.game.state === 'playing' && now.game.ply === body.ply + 1) {
        state.undo = { game: now.game.id, ply: now.game.ply, until: Date.now() + UNDO_MS };
        countDown();
      }
    });
  }

  /* Whether this tab may still take back its last move on this game: the
     move is still the last one, the game is still on, the ten seconds are
     not up. */
  function undoable(game) {
    var u = state.undo;
    return !!u && u.game === game.id && u.ply === game.ply && game.state === 'playing' && Date.now() < u.until;
  }

  function undoLabel() {
    return t('chessUndo', { n: Math.max(1, Math.ceil((state.undo.until - Date.now()) / 1000)) });
  }

  /* The button counts itself down, a second at a time, without redrawing the
     board under a piece somebody may be holding; when the time is up it goes,
     and that is one redraw. */
  function countDown() {
    if (undoTimer) clearInterval(undoTimer);
    undoTimer = setInterval(function () {
      var button = stack.querySelector('.chess-undo');
      if (state.undo && Date.now() < state.undo.until && button) {
        button.textContent = undoLabel();
        return;
      }
      clearInterval(undoTimer);
      undoTimer = null;
      state.undo = null;
      draw();
    }, 1000);
  }

  function takeBack(game) {
    var extra = { game: game.id, ply: game.ply };
    var you = state.answer.you;
    if (!you || you.role === 'visitor') extra.client = window.TTBDevice.id();
    state.undo = null;
    act('undo', 'chess_undo', extra, { 409: 'chessUndoLate' });
  }

  /* Every other write: the house's new public game, a member joining the line
     or leaving it, the house starting the first in line, a resignation, a game
     ended without a result. Each is reported by name and sent. */
  function act(action, event, extra, said) {
    if (state.busy) return;
    var body = { action: action };
    Object.keys(extra || {}).forEach(function (k) { body[k] = extra[k]; });
    window.TTBTrack.event(event);
    write(body, said);
  }

  /* Sends a write and redraws from what came back — a refusal that carries
     the board included, since the page may simply have been behind. `said`
     names the toast for a status the reader should hear about in words of its
     own; any other refusal is the one sentence for a write that did not go
     through. `landed` hears the answer to a write that went in, before it is
     drawn. */
  function write(body, said, landed) {
    state.busy = true;
    post(body).then(function (a) {
      state.busy = false;
      var toastKey = (said && said[a.status]) || (a.ok ? '' : 'chessMoveFailed');
      if (a.ok && landed) landed(a.out);
      if (a.out.ready) take(a.out, true);
      else draw();
      if (toastKey) toast(t(toastKey));
    });
  }

  /* ---------------------------------------------------------- what to say */

  function isHouse() {
    return !!(state.answer && state.answer.you && state.answer.you.role === 'house');
  }

  /* How a game that is over ended: the line in mono, and the sentence under
     it saying who won. */
  function sayOver(game) {
    var winner = game.result === '1-0' ? game.white : game.result === '0-1' ? game.black : null;
    var loser = game.result === '1-0' ? game.black : game.result === '0-1' ? game.white : null;
    var moves = winner ? (game.result === '1-0' ? Math.ceil(game.ply / 2) : Math.floor(game.ply / 2)) : 0;

    if (game.reason === 'mate') {
      return {
        who: t('chessMate'),
        why: moves > 1 ? t('chessWonIn', { who: sideName(winner), n: moves }) : t('chessWon', { who: sideName(winner) })
      };
    }
    if (game.reason === 'resign') {
      return { who: t('chessResigned', { who: sideName(loser) }), why: t('chessWon', { who: sideName(winner) }) };
    }
    if (game.reason === 'abandoned') return { who: t('chessAbandoned'), why: '' };
    if (game.reason === 'stalemate') return { who: t('chessStalemate'), why: '' };
    return {
      who: t('chessDraw'),
      why: game.reason === 'repetition' ? t('chessDrawRepetition')
         : game.reason === 'fifty' ? t('chessDrawFifty')
         : t('chessDrawMaterial')
    };
  }

  /* Whose move it is, and what that means for whoever is reading. */
  function sayTurn(g) {
    var game = g.game;
    var house = isHouse();

    if (game.state === 'over') {
      var said = sayOver(game);
      /* What happens next: the house starts the next public game; a member
         whose own game is over may join the line again. */
      var next = game.kind === 'public'
        ? (house ? t('chessNextYou') : t('chessNextHouse'))
        : t('chessAgain');
      return { who: said.who, why: said.why ? said.why + ' ' + next : next };
    }

    var mover = game.turn === 'w' ? game.white : game.black;
    var who = t('chessTurnOf', { who: sideName(mover) });
    var why;
    if (mover === 'house') {
      why = house ? t('chessTurnYou') : t('chessTurnHouseWhy');
    } else if (game.kind === 'public') {
      why = house ? t('chessTurnCity') : t('chessTurnEverybodyWhy');
    } else if (house) {
      /* The member's move, read by the house: nothing to add until the route
         says the quiet days are up, and then the reason for the button under
         the moves. */
      why = g.abandon
        ? t('chessAbandonWhy', { name: sideName(mover), n: Math.floor((Date.now() - game.lastAt) / 86400000) })
        : '';
    } else {
      who = t('chessTurnYours');
      why = t('chessTurnYoursWhy');
    }
    if (game.check) who += ' · ' + t('chessCheck');
    return { who: who, why: why };
  }

  /* --------------------------------------------------------------- drawing */

  function goButton(label, onPress) {
    var go = el('button', { type: 'button', className: 'go', textContent: label });
    go.addEventListener('click', onPress);
    return go;
  }

  function altButton(label, onPress) {
    var alt = el('button', { type: 'button', className: 'alt', textContent: label });
    alt.addEventListener('click', onPress);
    return alt;
  }

  function newGame() {
    act('new', 'chess_new_game');
  }

  function turnNode(g) {
    var game = g.game;
    var said = sayTurn(g);
    var kids = [el('p', { className: 'eyebrow', textContent: gameTitle(game) })];
    var p = state.promoting;

    if (p && p.game === game.id && p.ply === game.ply) {
      var white = game.turn === 'w';
      var seg = el('div', { className: 'chess-promote seg', role: 'group', 'aria-label': t('chessPromote') });
      PROMOTE.forEach(function (piece) {
        var btn = el('button', {
          type: 'button',
          className: 'btn',
          'aria-label': t(PIECE_NAME[piece]),
          textContent: GLYPH[white ? piece.toUpperCase() : piece] + TEXT
        });
        btn.addEventListener('click', function () { promote(piece); });
        seg.appendChild(btn);
      });
      kids.push(el('p', { className: 'chess-turn-who', textContent: t('chessPromote') }));
      kids.push(seg);
    } else {
      kids.push(el('p', { className: 'chess-turn-who', textContent: said.who }));
      if (said.why) kids.push(el('p', { className: 'chess-turn-why', textContent: said.why }));
    }

    /* The page's one filled action, where a game is over: the house starts
       the next public game, the member joins the line again. */
    if (game.state === 'over') {
      if (game.kind === 'public' && isHouse()) kids.push(goButton(t('chessNewGame'), newGame));
      else if (game.kind === 'private' && !isHouse()) kids.push(goButton(t('chessJoin'), join));
    }
    return el('div', { className: 'chess-turn' }, kids);
  }

  function lastLine(g) {
    var last = g.moves[g.moves.length - 1];
    if (!last) return null;
    return el('p', { className: 'chess-last' }, [
      t('chessLast') + ' ',
      el('b', { textContent: last.san }),
      ' · ' + moverName(last.by) + ' · ' + ago(last.at)
    ]);
  }

  /* King in check: the king of the side to move, when the last move's SAN
     says + or #. Read off the FEN, which is not a rule, only where it is. */
  function checkedSquare(game, pieces) {
    if (!game.check) return null;
    var king = game.turn === 'w' ? 'K' : 'k';
    for (var sq in pieces) {
      if (Object.prototype.hasOwnProperty.call(pieces, sq) && pieces[sq] === king) return sq;
    }
    return null;
  }

  function boardCard(g) {
    var game = g.game;
    var last = g.moves[g.moves.length - 1];

    /* The reader's side at the bottom: the house sits on its own colour,
       everybody else on the other one — Everybody's, or the member's own. */
    var houseIsBlack = game.black === 'house';
    var flip = isHouse() ? houseIsBlack : !houseIsBlack;

    var picked = pickedOn(game);
    if (!picked && state.picked && state.picked.game === game.id) state.picked = null;

    var card = el('section', { className: 'card chess-board-card', 'aria-label': gameTitle(game) });
    card.appendChild(turnNode(g));
    card.appendChild(boardNode({
      game: game,
      flip: flip,
      legal: g.legal || null,
      picked: picked,
      last: last && last.uci ? [last.uci.slice(0, 2), last.uci.slice(2, 4)] : [],
      checked: checkedSquare(game, parseFen(game.fen))
    }));
    var line = lastLine(g);
    if (line) card.appendChild(line);
    if (undoable(game)) {
      var back = altButton(undoLabel(), function () { takeBack(game); });
      back.className += ' chess-undo';
      card.appendChild(back);
    }
    return card;
  }

  /* The moves as numbered pairs, white's column then black's. Under a move of
     Everybody's, who played it — a hog is visible, which is why there is no
     rule against one; a private game has one player a side and says nothing
     under its moves. */
  function movesCard(g) {
    var game = g.game;
    var pub = game.kind === 'public';
    var card = el('section', { className: 'card chess-moves', 'aria-label': t('chessMoves') });
    card.appendChild(el('p', { className: 'eyebrow', textContent: t('chessMoves') }));
    card.appendChild(el('div', { className: 'chess-cols' }, [
      el('span'),
      el('span', { className: 'eyebrow', textContent: sideName(game.white) }),
      el('span', { className: 'eyebrow', textContent: sideName(game.black) })
    ]));

    function cell(move, side) {
      var kids = [el('span', { className: 'chess-san', textContent: move ? move.san : '' })];
      if (move && pub && side !== 'house') kids.push(el('span', { className: 'chess-who', textContent: moverName(move.by) }));
      return el('span', { className: 'chess-m' }, kids);
    }

    var list = el('ol', { className: 'chess-list' });
    for (var i = 0; i < g.moves.length; i += 2) {
      list.appendChild(el('li', null, [
        el('span', { className: 'chess-n', textContent: String(i / 2 + 1) }),
        cell(g.moves[i], game.white),
        cell(g.moves[i + 1], game.black)
      ]));
    }
    card.appendChild(list);
    /* "The first move is yours" is only true for a reader who has one. */
    if (!g.moves.length && g.legal) card.appendChild(el('p', { className: 'chess-empty', textContent: t('chessNoMoves') }));

    if (pub) {
      var score = state.answer.score || { everybody: 0, house: 0, drawn: 0 };
      card.appendChild(el('p', {
        className: 'chess-foot',
        textContent: t('chessScore', { n: game.n, a: score.everybody, b: score.house, d: score.drawn })
      }));
      /* Signed out: a name would go on the moves, and the map is where the
         account is made. */
      var you = state.answer.you;
      if (!you || you.role === 'visitor') {
        card.appendChild(el('p', { className: 'chess-signin', textContent: t('chessSignIn') }));
        card.appendChild(el('a', { className: 'alt', href: '/', textContent: t('chessSignInGo') }));
      }
      return card;
    }

    if (game.startedAt) {
      card.appendChild(el('p', { className: 'chess-foot', textContent: t('chessStarted', { when: span(game.startedAt) }) }));
    }
    /* The ways out of a private game being played: either side may resign,
       and the house may end it without a result once the route says the
       member has been quiet long enough. */
    if (game.state === 'playing') {
      card.appendChild(altButton(t('chessResign'), function () {
        if (window.confirm(t('chessResignSure'))) act('resign', 'chess_resign', { game: game.id });
      }));
      if (g.abandon) {
        card.appendChild(altButton(t('chessAbandon'), function () {
          act('abandon', 'chess_abandon', { game: game.id });
        }));
      }
    }
    return card;
  }

  function gameGrid(g) {
    return el('div', { className: 'chess-grid' }, [boardCard(g), movesCard(g)]);
  }

  /* No game yet: the house sees the button that starts the first, everybody
     else is told the board is being set up. */
  function emptyCard() {
    var kids = [
      el('p', { className: 'eyebrow', textContent: t('chessGameOf', { a: t('chessEverybody'), b: t('wordmark') }) }),
      el('p', { className: 'chess-turn-who', textContent: t('chessNoGame') })
    ];
    if (isHouse()) kids.push(goButton(t('chessFirstGame'), newGame));
    else kids.push(el('p', { className: 'chess-turn-why', textContent: t('chessNoGameWhy') }));
    return el('section', { className: 'card chess-board-card' }, [el('div', { className: 'chess-turn' }, kids)]);
  }

  /* ------------------------------------------------------------ one on one */

  function join() {
    act('join', 'chess_join', null, { 409: 'chessAlready', 429: 'chessFull' });
  }

  function chevron() {
    var ns = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('focusable', 'false');
    var path = document.createElementNS(ns, 'path');
    path.setAttribute('d', 'M9 5l7 7-7 7');
    svg.appendChild(path);
    return svg;
  }

  /* One person in line, as a row that goes to their page. A member whose
     account has gone keeps their place and has no page, so their row is the
     row's shape with nothing to press. */
  function queueRow(name, why, tag, playing) {
    var cls = 'menu-row' + (playing ? ' is-playing' : '');
    var kids = [
      el('span', { className: 'menu-say' }, [
        el('span', { className: 'menu-name' }, [
          sideName(name),
          tag ? el('span', { className: 'chess-tag', textContent: tag }) : null
        ]),
        el('span', { className: 'menu-why', textContent: why })
      ])
    ];
    var row;
    if (name) {
      kids.push(el('span', { className: 'menu-go', 'aria-hidden': 'true' }, [chevron()]));
      row = el('a', { className: cls, href: '/u/' + encodeURIComponent(name) }, kids);
    } else {
      row = el('div', { className: cls }, kids);
    }
    return el('li', { className: 'menu-item' }, [row]);
  }

  /* The one-on-one card, in whichever shape the reader's face needs: for a
     visitor the invitation, for a member the door or their place in line, for
     the house the line and the one action. Under each, who is waiting now. */
  function playCard() {
    var a = state.answer;
    var you = a.you || { role: 'visitor' };
    var queue = a.queue || [];
    var mine = a.mine && a.mine.game;
    var title;
    var why;
    var go = null;
    var alt = null;
    var rows = [];

    if (you.role === 'house') {
      title = t('chessWaitingToPlayYou');
      if (mine) {
        why = t('chessQueueBusy', { name: sideName(otherSide(mine)) });
        rows.push(queueRow(otherSide(mine), t('chessPlayingYou'), null, true));
      } else {
        why = t('chessQueueFree');
        if (queue.length) {
          var first = queue[0];
          go = goButton(t('chessStartWith', { name: sideName(first.name) }), function () {
            act('start', 'chess_start', { game: first.game });
          });
        }
      }
    } else if (you.role === 'member' && mine && mine.state === 'waiting') {
      var ahead = [];
      for (var i = 0; i < queue.length && queue[i].name !== you.name; i++) ahead.push(sideName(queue[i].name));
      title = t('chessInLine');
      why = ahead.length ? t('chessAhead', { n: ahead.length, names: ahead.join(', ') }) : t('chessAheadNone');
      alt = altButton(t('chessLeave'), function () { act('leave', 'chess_leave'); });
    } else if (you.role === 'member') {
      title = t('chessPlayTitle');
      why = t('chessPlayWhy');
      go = goButton(t('chessJoin'), join);
    } else {
      title = t('chessPlayTitle');
      why = t('chessPlayWhySignedOut');
    }

    queue.forEach(function (q) {
      var isYou = you.role === 'member' && q.name && q.name === you.name;
      rows.push(queueRow(q.name, t('chessSince', { when: span(q.since) }), isYou ? t('chessYou') : null, false));
    });

    return el('section', { className: 'card chess-play', 'aria-label': t('chessOneOnOne') }, [
      el('p', { className: 'eyebrow', textContent: t('chessOneOnOne') }),
      el('h2', { className: 'lists-title', textContent: title }),
      el('p', { className: 'chess-play-why', textContent: why }),
      go,
      el('p', { className: 'eyebrow chess-queue-head', textContent: t('chessWaitingNow') }),
      rows.length
        ? el('ul', { className: 'menu' }, rows)
        : el('p', { className: 'chess-queue-none', textContent: t('chessNobodyWaiting') }),
      alt
    ]);
  }

  /* -------------------------------------------------------------- the page */

  /* What the page holds, top to bottom, for whoever is reading — the faces
     table in .claude/skills/chess/SKILL.md. A visitor: the public game, then
     the invitation. A member: their own game while it is on or once it is
     over, else the card with the line in it; then the public game. The house:
     the line, the private game while one is on, the public game. */
  function cards() {
    var a = state.answer;
    var role = a.you ? a.you.role : 'visitor';
    var pub = a.public ? gameGrid(a.public) : emptyCard();
    var mine = a.mine;

    if (role === 'house') return [playCard(), mine ? gameGrid(mine) : null, pub];
    if (role === 'member') {
      if (mine && mine.game.state !== 'waiting') return [gameGrid(mine), pub];
      return [playCard(), pub];
    }
    return [pub, playCard()];
  }

  /* Pressing a square rebuilds the board, which would leave a keyboard
     standing in nothing: the square that had the focus gets it back, on the
     board it was on. */
  function draw() {
    if (!haveWords()) return;
    var focus = document.activeElement;
    var focusSq = focus && focus.getAttribute ? focus.getAttribute('data-sq') : null;
    var focusBoard = focusSq ? focus.parentNode.getAttribute('data-game') : null;

    clear(stack);
    var a = state.answer;
    if (!a || !a.ready) {
      stack.hidden = true;
      record.hidden = true;
      offline.hidden = false;
      return;
    }
    stack.hidden = false;
    offline.hidden = true;

    /* The house's own record under the lead, over both kinds of game. */
    record.hidden = !isHouse();
    if (isHouse()) {
      var r = a.record;
      record.textContent = t('chessRecord', { games: r.games, won: r.won, lost: r.lost, drawn: r.drawn });
    }

    cards().forEach(function (node) { if (node) stack.appendChild(node); });

    if (focusBoard) {
      var again = stack.querySelector('[data-game="' + focusBoard + '"] [data-sq="' + focusSq + '"]');
      if (again && !again.disabled) again.focus();
    }
  }

  /* An answer arrives — the first, a poll's, or a write's. A poll that found
     the board as it was is not drawn again, so the piece somebody is holding
     stays held; anything a write returned always is. */
  function take(out, force) {
    var words = { ui: 1, lang: 1, langs: 1 };
    var keep = {};
    Object.keys(out).forEach(function (k) { if (!words[k]) keep[k] = out[k]; });
    var signature = JSON.stringify(keep);

    state.answer = keep;
    if (!force && signature === state.drawn) return;
    state.drawn = signature;
    draw();
  }

  /* -------------------------------------------------------------- the poll */

  function poll() {
    if (document.hidden || state.busy) return;
    /* Nothing has ever arrived, so there are no words and no board to keep:
       the poll is the first ask again. */
    if (!haveWords()) { first(); return; }
    ask(API).then(function (answer) {
      if (state.busy) return;
      /* A poll that did not get through leaves what is on the board where it
         is; the page has been right until now and will be again on the next
         one. */
      if (answer.status === 0) return;
      take(answer.out, false);
    });
  }

  function startPolling() {
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = setInterval(poll, POLL_MS);
  }

  function stopPolling() {
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = null;
  }

  /* The first ask, and the ask a poll repeats while there is still nothing to
     draw with: the words, the codes and the board in one answer. */
  function first() {
    ask(API + '?lang=' + encodeURIComponent(wanted().join(','))).then(function (answer) {
      /* Nothing arrived, not even the words to say so. What is left is the
         markup's own English, which says the board is not answering, and the
         poll keeps trying. */
      if (answer.status === 0 || !answer.out.ui || haveWords()) {
        if (!haveWords()) offline.hidden = false;
        return;
      }

      state.lang = answer.out.lang || DEFAULT_LANG;
      state.ui = answer.out.ui;
      state.langs = answer.out.langs || [];
      applyStaticStrings();
      drawSwitch();
      mountRadio();
      take(answer.out, true);
    });
  }

  function boot() {
    stack = document.getElementById('stack');
    offline = document.getElementById('offline');
    record = document.getElementById('you');

    applyStyle();
    first();
    startPolling();

    /* Not while nobody is looking, and at once when somebody is again. */
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) {
        stopPolling();
      } else {
        poll();
        startPolling();
      }
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
