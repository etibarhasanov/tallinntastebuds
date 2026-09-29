/**
 * Tallinn Tastebuds — /chess.html, one chessboard for the whole city.
 *
 * WHAT THIS PAGE IS
 *
 * A board that is always on the page: Everybody against Tallinn Tastebuds.
 * Whoever is here when it is Everybody's turn may play the next move, signed
 * in or not, and the house — the owner's account — answers when it gets to the
 * board, from this same page, which shows it a different face. **Chess** in
 * README.md is the whole of the feature and .claude/skills/chess/SKILL.md is
 * the shape that was agreed before any of it was written; this file is the
 * first of the pages that draw it, and the public game is all it draws so far.
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
 * Every write is sent with the ply the page read — how many half-moves had
 * been played — and the route files the move one past it. If somebody got
 * there first the route says 409 and carries the board as it now is, and the
 * page redraws from that, never from what it sent. The same goes for every
 * other answer, the poll included: nothing on this page keeps a board of its
 * own beyond the square somebody has picked up, and that is dropped the moment
 * the game it was picked in has moved on.
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
    busy: false
  };

  var stack = null;
  var offline = null;
  var pollTimer = null;

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

  /* "just now", "3 min ago", "2 h ago", "4 d ago" — the unit is a word of its
     own in each language and "ago" wraps it, since where the word goes is a
     language's to say. */
  function ago(at) {
    var s = Math.max(0, Math.floor((Date.now() - at) / 1000));
    if (s < 60) return t('chessJustNow');
    var m = Math.floor(s / 60);
    if (m < 60) return t('chessAgo', { when: t('chessMin', { n: m }) });
    var h = Math.floor(m / 60);
    if (h < 24) return t('chessAgo', { when: t('chessHours', { n: h }) });
    return t('chessAgo', { when: t('chessDays', { n: Math.floor(h / 24) }) });
  }

  /* ---------------------------------------------------------------- names */

  /* The names a side or a mover goes by, as the page prints them. */
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

    var node = el('div', { className: 'chess-board', role: 'group' });
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
        if (live) btn.addEventListener('click', function () { press(name); });
        node.appendChild(btn);
      });
    });
    return node;
  }

  /* ------------------------------------------------------- pressing a square */

  function publicGame() {
    return state.answer && state.answer.public;
  }

  /* A press picks a piece up, a second press on one of its dots puts it
     there, and a press anywhere else puts it back. The dots are only ever the
     squares some legal move of that piece ends on. */
  function press(sq) {
    var pub = publicGame();
    if (!pub || !pub.legal || state.busy) return;

    var picked = state.picked && state.picked.game === pub.game.id && state.picked.ply === pub.game.ply
      ? state.picked.sq : null;
    state.promoting = null;

    if (picked && targetsOf(pub.legal, picked).indexOf(sq) !== -1) {
      var options = pub.legal.filter(function (u) { return u.slice(0, 4) === picked + sq; });
      if (options.length > 1 || options[0].length === 5) {
        /* A pawn reaching the last rank: four choices where the sentence was. */
        state.promoting = { game: pub.game.id, ply: pub.game.ply, from: picked, to: sq };
        draw();
        return;
      }
      send(pub, options[0]);
      return;
    }

    if (startsOf(pub.legal).indexOf(sq) !== -1 && sq !== picked) {
      state.picked = { game: pub.game.id, ply: pub.game.ply, sq: sq };
    } else {
      state.picked = null;
    }
    draw();
  }

  function promote(piece) {
    var pub = publicGame();
    var p = state.promoting;
    if (!pub || !p || state.busy) return;
    send(pub, p.from + p.to + piece);
  }

  /* The write. What comes back is drawn whatever it was: a 409 carries the
     board as it now is, and so does anything else the route refused after
     reading it. */
  function send(pub, uci) {
    state.busy = true;
    state.picked = null;
    state.promoting = null;

    var body = { action: 'move', game: pub.game.id, ply: pub.game.ply, move: uci };
    var you = state.answer.you;
    if (!you || you.role === 'visitor') body.client = window.TTBDevice.id();

    window.TTBTrack.event('chess_move', { kind: pub.game.kind, ply: pub.game.ply + 1 });

    post(body).then(function (a) {
      state.busy = false;
      if (a.ok) {
        take(a.out, true);
      } else if (a.status === 409 && a.out.ready) {
        take(a.out, true);
        toast(t('chessGotThereFirst'));
      } else {
        toast(t('chessMoveFailed'));
        draw();
      }
    });
  }

  function startNext() {
    if (state.busy) return;
    state.busy = true;
    window.TTBTrack.event('chess_new_game');
    post({ action: 'new' }).then(function (a) {
      state.busy = false;
      if (a.ok || (a.status === 409 && a.out.ready)) take(a.out, true);
      else { toast(t('chessMoveFailed')); draw(); }
    });
  }

  /* ---------------------------------------------------------- what to say */

  function isHouse() {
    return !!(state.answer && state.answer.you && state.answer.you.role === 'house');
  }

  /* Whose move it is, and what that means for whoever is reading. */
  function sayTurn(game) {
    var house = isHouse();
    var who;
    var why;
    var next = '';

    if (game.state === 'over') {
      var winner = game.result === '1-0' ? game.white : game.result === '0-1' ? game.black : null;
      var moves = winner ? (game.result === '1-0' ? Math.ceil(game.ply / 2) : Math.floor(game.ply / 2)) : 0;
      if (game.reason === 'mate') {
        who = t('chessMate');
        why = moves > 1
          ? t('chessWonIn', { who: sideName(winner), n: moves })
          : t('chessWon', { who: sideName(winner) });
      } else if (game.reason === 'stalemate') {
        who = t('chessStalemate');
        why = '';
      } else {
        who = t('chessDraw');
        why = game.reason === 'repetition' ? t('chessDrawRepetition')
            : game.reason === 'fifty' ? t('chessDrawFifty')
            : t('chessDrawMaterial');
      }
      next = house ? t('chessNextYou') : t('chessNextHouse');
      return { who: who, why: why ? why + ' ' + next : next };
    }

    var mover = game.turn === 'w' ? game.white : game.black;
    who = t('chessTurnOf', { who: sideName(mover) });
    if (game.check) who += ' · ' + t('chessCheck');
    if (mover === 'house') why = house ? t('chessTurnYou') : t('chessTurnHouseWhy');
    else why = house ? t('chessTurnCity') : t('chessTurnEverybodyWhy');
    return { who: who, why: why };
  }

  /* --------------------------------------------------------------- drawing */

  function turnNode(pub) {
    var game = pub.game;
    var said = sayTurn(game);
    var kids = [
      el('p', { className: 'eyebrow', textContent: t('chessGameOf', { a: t('chessEverybody'), b: t('wordmark') }) })
    ];

    if (state.promoting) {
      var mine = game.turn === 'w';
      var seg = el('div', { className: 'chess-promote seg', role: 'group', 'aria-label': t('chessPromote') });
      PROMOTE.forEach(function (p) {
        var btn = el('button', {
          type: 'button',
          className: 'btn',
          'aria-label': t(PIECE_NAME[p]),
          textContent: GLYPH[mine ? p.toUpperCase() : p] + TEXT
        });
        btn.addEventListener('click', function () { promote(p); });
        seg.appendChild(btn);
      });
      kids.push(el('p', { className: 'chess-turn-who', textContent: t('chessPromote') }));
      kids.push(seg);
    } else {
      kids.push(el('p', { className: 'chess-turn-who', textContent: said.who }));
      if (said.why) kids.push(el('p', { className: 'chess-turn-why', textContent: said.why }));
    }

    if (game.state === 'over' && isHouse()) {
      var go = el('button', { type: 'button', className: 'go', textContent: t('chessNewGame') });
      go.addEventListener('click', startNext);
      kids.push(go);
    }
    return el('div', { className: 'chess-turn' }, kids);
  }

  function lastLine(pub) {
    var last = pub.moves[pub.moves.length - 1];
    if (!last) return null;
    var line = el('p', { className: 'chess-last' }, [
      t('chessLast') + ' ',
      el('b', { textContent: last.san }),
      ' · ' + moverName(last.by) + ' · ' + ago(last.at)
    ]);
    return line;
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

  function boardCard(pub) {
    var game = pub.game;
    var house = isHouse();
    var pieces = parseFen(game.fen);
    var last = pub.moves[pub.moves.length - 1];

    /* The reader's side at the bottom: the house sits on its own colour,
       everybody else on Everybody's. */
    var houseIsBlack = game.black === 'house';
    var flip = house ? houseIsBlack : !houseIsBlack;

    var picked = state.picked && state.picked.game === game.id && state.picked.ply === game.ply
      ? state.picked.sq : null;
    if (!picked) state.picked = null;

    var card = el('section', {
      className: 'card chess-board-card',
      'aria-label': t('chessGameOf', { a: t('chessEverybody'), b: t('wordmark') })
    });
    card.appendChild(turnNode(pub));
    card.appendChild(boardNode({
      game: game,
      flip: flip,
      legal: pub.legal || null,
      picked: picked,
      last: last && last.uci ? [last.uci.slice(0, 2), last.uci.slice(2, 4)] : [],
      checked: checkedSquare(game, pieces)
    }));
    var line = lastLine(pub);
    if (line) card.appendChild(line);
    return card;
  }

  /* The moves as numbered pairs, white's column then black's, and under the
     move of Everybody's who played it — a hog is visible, which is why there
     is no rule against one. */
  function movesCard(pub) {
    var game = pub.game;
    var card = el('section', { className: 'card chess-moves', 'aria-label': t('chessMoves') });
    card.appendChild(el('p', { className: 'eyebrow', textContent: t('chessMoves') }));
    card.appendChild(el('div', { className: 'chess-cols' }, [
      el('span'),
      el('span', { className: 'eyebrow', textContent: sideName(game.white) }),
      el('span', { className: 'eyebrow', textContent: sideName(game.black) })
    ]));

    function cell(move, side) {
      var kids = [el('span', { className: 'chess-san', textContent: move ? move.san : '' })];
      if (move && side !== 'house') kids.push(el('span', { className: 'chess-who', textContent: moverName(move.by) }));
      return el('span', { className: 'chess-m' }, kids);
    }

    var list = el('ol', { className: 'chess-list' });
    for (var i = 0; i < pub.moves.length; i += 2) {
      list.appendChild(el('li', null, [
        el('span', { className: 'chess-n', textContent: String(i / 2 + 1) }),
        cell(pub.moves[i], game.white),
        cell(pub.moves[i + 1], game.black)
      ]));
    }
    card.appendChild(list);
    if (!pub.moves.length) card.appendChild(el('p', { className: 'chess-empty', textContent: t('chessNoMoves') }));

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

  /* No game yet: the house sees the button that starts the first, everybody
     else is told the board is being set up. */
  function emptyCard() {
    var kids = [
      el('p', { className: 'eyebrow', textContent: t('chessGameOf', { a: t('chessEverybody'), b: t('wordmark') }) }),
      el('p', { className: 'chess-turn-who', textContent: t('chessNoGame') })
    ];
    if (isHouse()) {
      var go = el('button', { type: 'button', className: 'go', textContent: t('chessFirstGame') });
      go.addEventListener('click', startNext);
      kids.push(go);
    } else {
      kids.push(el('p', { className: 'chess-turn-why', textContent: t('chessNoGameWhy') }));
    }
    return el('section', { className: 'card chess-board-card' }, [el('div', { className: 'chess-turn' }, kids)]);
  }

  /* Pressing a square rebuilds the board, which would leave a keyboard
     standing in nothing: the square that had the focus gets it back. */
  function draw() {
    if (!haveWords()) return;
    var focused = document.activeElement && document.activeElement.getAttribute
      ? document.activeElement.getAttribute('data-sq') : null;

    clear(stack);
    var a = state.answer;
    if (!a || !a.ready) {
      stack.hidden = true;
      offline.hidden = false;
      return;
    }
    stack.hidden = false;
    offline.hidden = true;

    var pub = a.public;
    if (!pub) {
      stack.appendChild(emptyCard());
      return;
    }
    stack.appendChild(el('div', { className: 'chess-grid' }, [boardCard(pub), movesCard(pub)]));

    if (focused) {
      var again = stack.querySelector('[data-sq="' + focused + '"]');
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
