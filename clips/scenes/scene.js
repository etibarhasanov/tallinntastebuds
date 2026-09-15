/* Tallinn Tastebuds — what draws a blog clip.
 *
 * A scene is one interaction from the site, arranged on a 480-point stage and
 * written as a pure function of time: given t in milliseconds, put everything
 * where it is at t. Nothing animates itself, no transition runs, no timer
 * fires. That is what lets tools/blogclips.mjs draw eighteen moments of the
 * same scene side by side in one screenshot and get exactly the frames it
 * asked for, on any machine, in any year.
 *
 * A scene file is markup and two functions:
 *
 *     Clip.scene({
 *       build: function (stage) { ...put the site's components on it... },
 *       at: function (t, held) { ...place them for this millisecond... }
 *     });
 *
 * `build` runs once per stage and hands back whatever `at` needs to move.
 * `at` is called with a time and those handles. Everything else — the stage,
 * the cursor, the easing — is here.
 *
 * Open a scene in a browser with no query string and it plays the whole thing
 * on a loop, in real time, which is how you write one. `?t=1500` freezes it at
 * a millisecond, which is the only thing the tool ever asks for.
 */
(function () {
  'use strict';

  function param(name) {
    return new URLSearchParams(window.location.search).get(name);
  }

  function said() {
    var meta = document.querySelector('meta[name="clip"]');
    var out = { ms: 4000, w: 480, h: 300 };
    if (!meta) return out;
    meta.getAttribute('content').split(';').forEach(function (pair) {
      var bits = pair.split('=');
      if (bits.length === 2) out[bits[0].trim()] = Number(bits[1]);
    });
    return out;
  }

  /* Cubic in and out. Everything on this site that moves under its own steam
     moves on an ease; a cursor crossing a card at a constant speed reads as a
     machine rather than as a hand. */
  function ease(p) {
    return p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
  }

  var ARROW = '<svg viewBox="0 0 32 32" aria-hidden="true">' +
    '<path d="M8 3l17 13.5-7.6 1.3 4.4 8.6-3.6 1.8-4.4-8.7L8 25z"/></svg>';

  var Clip = {
    /* 0 before t0, 1 after t1, eased in between. Every movement in every
       scene is built out of this one call. */
    at: function (t, t0, t1) {
      if (t <= t0) return 0;
      if (t >= t1) return 1;
      return ease((t - t0) / (t1 - t0));
    },

    /* The same, as a number between two values. */
    lerp: function (t, t0, t1, from, to) {
      return from + (to - from) * Clip.at(t, t0, t1);
    },

    /* Up and back down again across a window: what a tap looks like, and a
       toast that arrives and leaves. */
    pulse: function (t, t0, t1) {
      var half = (t0 + t1) / 2;
      return t < half ? Clip.at(t, t0, half) : 1 - Clip.at(t, half, t1);
    },

    /* The pointer, and the ring it throws when it presses something. Hand it
       a point and a press window; it does the rest. */
    cursor: function (stage) {
      var el = document.createElement('div');
      el.className = 'clip-cursor';
      el.innerHTML = ARROW;
      stage.appendChild(el);

      var ring = document.createElement('div');
      ring.className = 'clip-tap';
      ring.style.display = 'none';
      stage.appendChild(ring);

      return {
        /* Where the point of the arrow is, and how far into a press. */
        to: function (x, y, press) {
          var down = press ? 1 - 0.14 * Clip.pulse(press.t, press.from, press.to) : 1;
          el.style.transform = 'translate(' + (x - 9) + 'px,' + (y - 4) + 'px) scale(' + down + ')';
        },
        /* The ring, over the thing being pressed. */
        tap: function (x, y, size, p) {
          if (p <= 0) { ring.style.display = 'none'; return; }
          var grew = size * (0.55 + 0.45 * p);
          ring.style.display = '';
          ring.style.width = grew + 'px';
          ring.style.height = grew + 'px';
          ring.style.opacity = String(1 - p * 0.65);
          ring.style.transform = 'translate(' + (x - grew / 2) + 'px,' + (y - grew / 2) + 'px)';
        }
      };
    },

    /* A few streets under the chrome, for the scenes that are about the map.
       Drawn rather than photographed: there are no tiles here and there is no
       pretending there are. */
    ground: function (stage, w, h) {
      var lines = [];
      for (var x = -40; x < w + 80; x += 62) {
        lines.push('M' + x + ' -10 L' + (x + 46) + ' ' + (h + 10));
      }
      for (var y = 18; y < h; y += 54) {
        lines.push('M-10 ' + y + ' L' + (w + 10) + ' ' + (y - 16));
      }
      var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('class', 'clip-ground');
      svg.setAttribute('viewBox', '0 0 ' + w + ' ' + h);
      svg.innerHTML = '<path d="' + lines.join(' ') + '"/>';
      stage.insertBefore(svg, stage.firstChild);
      return svg;
    },

    scene: function (spec) {
      document.addEventListener('DOMContentLoaded', function () {
        var clip = said();

        /* The style the clip is being drawn in. Every colour on the stage
           comes out of the tokens, so this one attribute is the whole of the
           dark version — the same thing the map does when somebody presses
           the swatch. */
        if (param('style') === 'green') {
          document.documentElement.setAttribute('data-style', 'green');
          document.documentElement.style.colorScheme = 'dark';
        }

        function stageAt(ms) {
          var stage = document.createElement('div');
          stage.className = 'clip-stage';
          stage.style.width = clip.w + 'px';
          stage.style.height = clip.h + 'px';
          document.body.appendChild(stage);
          var held = spec.build(stage, clip) || {};
          spec.at(ms, held, clip);
          return { stage: stage, held: held };
        }

        /* Frozen at ?t=, which is what tools/blogclips.mjs asks for one frame
           at a time — or played through, which is the only way a scene is
           ever watched by a person. */
        var frozen = param('t');
        var one = stageAt(frozen === null ? 0 : Number(frozen));
        if (frozen !== null) return;

        var began = null;
        (function tick(now) {
          if (began === null) began = now;
          var t = now - began;
          spec.at(t > clip.ms ? clip.ms : t, one.held, clip);
          if (t < clip.ms + 600) window.requestAnimationFrame(tick);
          else { began = null; window.requestAnimationFrame(tick); }
        })(0);
      });
    }
  };

  window.Clip = Clip;
})();
