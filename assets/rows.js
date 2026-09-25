/* Tallinn Tastebuds — the page of links on a profile.
 *
 * The rows under somebody's name on /u/<name>, between the handles and the
 * lists: a showreel, an agency page, a note, a heading over a group of them,
 * in the order they put them. Two pages draw them — the profile, and the
 * account page where they are written — which is why this is a file of its
 * own rather than a block inside one of them, the same arrangement
 * assets/links.js and assets/pins.js have.
 *
 * WHAT A ROW IS IS DECIDED BY WHAT IS FILLED
 *
 * A title with an address is a link. A title with a note is a note, and the
 * page opens it as a sheet. A title on its own is a heading. Nothing stores
 * the kind and nothing here asks for one — see db/schema.sql.
 *
 * A LINK TO A VIDEO IS A PLAYER, AND THE PLAYER'S ADDRESS IS BUILT HERE
 *
 * What is stored is the address somebody pasted — the watch page, the reel,
 * the Drive file. What goes into the frame is built out of it by PLAYERS
 * below: the id is read off the address, and the frame's address is the
 * site's own embed shape with that id in it. Nothing anybody typed reaches
 * an iframe's src, which is the same rule assets/links.js keeps for a handle,
 * kept for the one thing on this site that draws somebody else's page
 * inside a frame.
 *
 * NONE OF THE PLAYERS IS OURS, AND THE WAY OUT IS UNDER EVERY ONE
 *
 * Each site decides for itself what its frame shows on somebody else's page:
 * a Vimeo owner can restrict embedding to named domains, a Drive file plays
 * in a frame only when it is shared with anyone who has the link, and
 * Instagram hands a phone a card rather than a player — embedInstagram() in
 * assets/app.js has the five weeks that took to learn, and the rule here is
 * the one it ended on: on a phone an Instagram row stays a link, decided
 * once, on load. So every player has "Open it on …" printed under it, to the
 * address the row carries, in the same tab: a youtube.com or instagram.com
 * address is a universal link, and the tab a new-tab link leaves behind when
 * the app opens is the blank page somebody comes back to.
 *
 * A player comes out of its card on the second press rather than being
 * hidden, because none of them can be paused from outside its own script
 * and a frame that is not in the page is not playing.
 *
 * ES5, one global, like every other file in assets/. draw() takes the
 * page's own t() and its reporter, because this file has neither.
 */
window.TTBRows = (function () {
  'use strict';

  /* The map's own line between a phone and everything else — isNarrow() in
     assets/app.js — because the one thing it decides here is the one thing
     it decides there: whether Instagram gets a frame at all. */
  var PHONE = '(max-width: 860px)';

  /* Which addresses get a player, the id read off each, and the frame built
     from it. `tall` is a phone's shape rather than a screen's; `card` is
     Instagram, which serves a phone a card rather than a player. */
  var PLAYERS = [
    {
      host: 'YouTube',
      re: /^https:\/\/(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?(?:[^#]*&)?v=|shorts\/|embed\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{11})(?:[^A-Za-z0-9_-]|$)/,
      frame: function (m) { return 'https://www.youtube-nocookie.com/embed/' + m[1] + '?rel=0&playsinline=1'; },
      tall: false
    },
    {
      host: 'Vimeo',
      re: /^https:\/\/(?:www\.|player\.)?vimeo\.com\/(?:video\/)?(\d{6,})(?:\D|$)/,
      frame: function (m) { return 'https://player.vimeo.com/video/' + m[1] + '?dnt=1'; },
      tall: false
    },
    {
      host: 'Instagram',
      /* A link copied while browsing your own grid carries the profile name
         in front of the shortcode, a shape Instagram serves the post at but
         not the embed, so the kind and the shortcode are all that is kept.
         /reels/ is the tab and /reel/ is the post; the embed knows the
         second. */
      re: /^https:\/\/(?:www\.)?instagram\.com\/(?:[A-Za-z0-9._]+\/)?(p|reels?|tv)\/([A-Za-z0-9_-]+)/,
      frame: function (m) {
        return 'https://www.instagram.com/' + (m[1] === 'reels' ? 'reel' : m[1]) + '/' + m[2] + '/embed/';
      },
      tall: true,
      card: true
    },
    {
      host: 'TikTok',
      re: /^https:\/\/(?:www\.)?tiktok\.com\/@[^/]+\/video\/(\d{6,})/,
      frame: function (m) { return 'https://www.tiktok.com/embed/v2/' + m[1]; },
      tall: true
    },
    {
      host: 'Google Drive',
      re: /^https:\/\/drive\.google\.com\/file\/d\/([A-Za-z0-9_-]+)/,
      frame: function (m) { return 'https://drive.google.com/file/d/' + m[1] + '/preview'; },
      tall: false
    }
  ];

  function node(tag, props, kids) {
    var out = document.createElement(tag);
    Object.keys(props || {}).forEach(function (k) {
      var v = props[k];
      if (v === null || v === undefined || v === false) return;
      if (k === 'className') out.className = v;
      else if (k === 'textContent') out.textContent = v;
      else out.setAttribute(k, v === true ? '' : String(v));
    });
    (kids || []).forEach(function (kid) {
      if (kid) out.appendChild(typeof kid === 'string' ? document.createTextNode(kid) : kid);
    });
    return out;
  }

  /* The player an address gets, or null for an address that is a plain link. */
  function player(url) {
    for (var i = 0; i < PLAYERS.length; i++) {
      var m = PLAYERS[i].re.exec(url);
      if (m) return { host: PLAYERS[i].host, src: PLAYERS[i].frame(m), tall: PLAYERS[i].tall, card: !!PLAYERS[i].card };
    }
    return null;
  }

  /* The line under a plain link: where it goes, because a reader trusts the
     name above it. */
  function hostOf(url) {
    try { return new URL(url).hostname.replace(/^www\./, ''); } catch (e) { return ''; }
  }

  /* A note's place in the address — /u/kate#acting-cv — out of its title,
     so the link somebody sends reads as what it opens. Letters of the four
     alphabets the site is read in, digits, and hyphens for the rest; a title
     that is all emoji becomes "note". `taken` keeps two notes with one title
     apart. */
  function slug(title, taken) {
    var base = String(title).toLowerCase()
      .replace(/[^a-z0-9\u00c0-\u024f\u0400-\u04ff\u0530-\u058f]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'note';
    var out = base;
    for (var n = 2; taken[out]; n++) out = base + '-' + n;
    taken[out] = true;
    return out;
  }

  function say(title, why) {
    return node('span', { className: 'menu-say' }, [
      node('span', { className: 'menu-name', textContent: title }),
      why ? node('span', { className: 'menu-why', textContent: why }) : null
    ]);
  }

  /* What a press does, said on the right: a chevron for somewhere else or a
     sheet, a triangle for a player that opens here, and a cross once it has. */
  function mark(plays) {
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.innerHTML = plays
      ? '<path class="ico-play" d="M9 6.5l9 5.5-9 5.5z"/><path class="ico-shut" d="M7 7l10 10M17 7L7 17"/>'
      : '<path d="M9 6l6 6-6 6"/>';
    return node('span', { className: 'menu-go', 'aria-hidden': 'true' }, [svg]);
  }

  function playerBlock(row, play, t) {
    var frame = node('div', { className: 'lists-page-frame' + (play.tall ? ' is-tall' : '') }, [
      node('iframe', {
        src: play.src,
        title: row.title,
        allow: 'autoplay; clipboard-write; encrypted-media; picture-in-picture; fullscreen',
        allowfullscreen: true,
        referrerpolicy: 'strict-origin-when-cross-origin'
      })
    ]);
    var out = node('p', { className: 'lists-page-out' }, [
      t('rowsTrouble') + ' ',
      node('a', { href: row.url, rel: 'nofollow noopener', textContent: t('rowsOpen', { host: play.host }) }),
      '.'
    ]);
    return node('div', { className: 'lists-page-player' }, [frame, out]);
  }

  /* The rows, as the profile draws them.
     opts.t        the page's t()
     opts.play     whether a video row opens a player here; off on the
                   account page, where the rows are a picture of the profile
     opts.onNote   what opens a note: (row, slug)
     opts.report   the page's reporter, (name, params), or none */
  function draw(rows, opts) {
    var t = opts.t;
    var phone = window.matchMedia && window.matchMedia(PHONE).matches;
    var report = opts.report || function () {};
    var taken = {};
    var ul = node('ul', { className: 'lists-page' });

    rows.forEach(function (row, i) {
      if (!row.url && !row.note) {
        ul.appendChild(node('li', { className: 'lists-page-heading' }, [
          node('h2', { className: 'lists-page-head', textContent: row.title })
        ]));
        return;
      }

      var li = node('li', { className: 'card' });
      var play = row.url ? player(row.url) : null;

      if (row.note) {
        var id = slug(row.title, taken);
        var open = node('button', { type: 'button', className: 'lists-page-row' }, [say(row.title, t('rowsNote')), mark(false)]);
        open.addEventListener('click', function () {
          report('profile_note', { row: i + 1 });
          opts.onNote(row, id);
        });
        li.appendChild(open);
      } else if (opts.play && play && !(phone && play.card)) {
        var toggle = node('button', { type: 'button', className: 'lists-page-row', 'aria-expanded': 'false' }, [say(row.title, play.host), mark(true)]);
        toggle.addEventListener('click', function () {
          var up = li.querySelector('.lists-page-player');
          if (up) {
            li.removeChild(up);
            toggle.setAttribute('aria-expanded', 'false');
            return;
          }
          report('profile_play', { row: i + 1, host: play.host });
          li.appendChild(playerBlock(row, play, t));
          toggle.setAttribute('aria-expanded', 'true');
        });
        li.appendChild(toggle);
      } else {
        /* Somewhere else. A video on a phone goes in the same tab, for the
           reason in the header; everything else leaves the site the way a
           handle does. */
        var go = node('a', {
          className: 'lists-page-row',
          href: row.url,
          rel: 'nofollow noopener',
          target: play ? null : '_blank'
        }, [say(row.title, play ? play.host : hostOf(row.url)), mark(false)]);
        go.addEventListener('click', function () {
          report('profile_row', { row: i + 1, host: play ? play.host : hostOf(row.url) });
        });
        li.appendChild(go);
      }
      ul.appendChild(li);
    });
    return ul;
  }

  /* A note, opened over the page. One <dialog> wearing the map's .scrim, so
     the ground behind it, Escape, the focus kept inside it and the page going
     inert all come from the browser and the colours from the site; a press
     on the ground round the card lands on the dialog itself, which is how it
     closes. Paragraphs are blank lines and a line end inside one is a line
     break; there is no other formatting, and cleanRows() on the server has
     already made the line ends one kind.

     `addressed` is the profile: there the address says which note is open —
     /u/kate#acting-cv, the slug of its title — so a link to a note arrives
     with it already up, and closing it takes the hash off without adding a
     step to Back. The account page draws the same sheet and leaves its
     address alone. The caller puts `node` in the document before arrive(),
     because a dialog opens only from inside one. */
  function sheet(t, addressed) {
    var title = node('h2', { className: 'lists-page-note-title', id: 'note-title' });
    var text = node('div', { className: 'lists-page-note-text' });
    var close = node('button', { type: 'button', className: 'panel-close lists-page-note-close', 'aria-label': t('close') });
    close.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6 6l12 12M18 6L6 18"/></svg>';
    var foot = node('button', { type: 'button', className: 'alt', textContent: t('close') });
    var dialog = node('dialog', { className: 'scrim lists-page-scrim', 'aria-labelledby': 'note-title' }, [
      node('article', { className: 'card lists-page-note' }, [
        close,
        node('p', { className: 'eyebrow', textContent: t('rowsNote') }),
        title,
        text,
        node('div', { className: 'lists-page-note-foot' }, [foot])
      ])
    ]);
    var bare = window.location.pathname + window.location.search;

    function shut() { dialog.close(); }
    close.addEventListener('click', shut);
    foot.addEventListener('click', shut);
    dialog.addEventListener('click', function (ev) {
      if (ev.target === dialog) shut();
    });
    /* Escape closes it without passing through either button, so the
       address is put back here rather than in them. */
    dialog.addEventListener('close', function () {
      if (addressed) history.replaceState(null, '', bare);
    });

    function open(row, id) {
      title.textContent = row.title;
      while (text.firstChild) text.removeChild(text.firstChild);
      row.note.split('\n\n').forEach(function (para) {
        var p = node('p');
        para.split('\n').forEach(function (line, i) {
          if (i) p.appendChild(node('br'));
          p.appendChild(document.createTextNode(line));
        });
        text.appendChild(p);
      });
      if (!dialog.open) dialog.showModal();
      if (addressed) history.replaceState(null, '', bare + '#' + id);
    }

    /* A link to a note: the hash the page arrived with, against the slug of
       each note in turn, made the way draw() makes them. */
    function arrive(rows) {
      var wanted = window.location.hash.slice(1);
      if (!wanted) return;
      var taken = {};
      for (var i = 0; i < rows.length; i++) {
        if (!rows[i].note) continue;
        if (slug(rows[i].title, taken) === wanted) { open(rows[i], wanted); return; }
      }
    }

    return { node: dialog, open: open, arrive: arrive };
  }

  /* Instagram's frame posts its own height out once it has drawn, and the
     frame is corrected to it. The same listener as wireReelMeasure() in
     assets/app.js, over this page's frames rather than the panel's — two
     files that cannot import from each other. Wired once per page. */
  function measure() {
    window.addEventListener('message', function (ev) {
      if (!/^https:\/\/(www\.)?instagram\.com$/.test(ev.origin)) return;

      var frames = document.querySelectorAll('.lists-page-frame.is-tall iframe');
      var frame = null;
      for (var i = 0; i < frames.length; i++) {
        if (frames[i].contentWindow === ev.source) { frame = frames[i]; break; }
      }
      if (!frame) return;

      var data = ev.data;
      if (typeof data === 'string') {
        try { data = JSON.parse(data); } catch (e) { return; }
      }

      var details = (data && data.details) || data;
      var height = Number(details && details.height);
      var width = frame.offsetWidth;
      if (!height || !width || height < 100) return;

      frame.parentNode.style.aspectRatio = width + ' / ' + height;
    });
  }

  return { draw: draw, sheet: sheet, measure: measure, player: player };
})();
