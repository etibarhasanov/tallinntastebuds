/* Tallinn Tastebuds — the radio, on every page that has one.
 *
 * A station on a button, for the same reason a restaurant map has a colour
 * rail: it is somebody's map, not a directory.
 *
 * A plain <audio> element and one URL. No SoundCloud or YouTube iframe, which
 * would cost a visitor third party cookies, a megabyte of player and a track
 * that gets taken down while nobody is looking. The element is built on first
 * press, so a visitor who never presses it pays nothing.
 *
 * The station lives in data/radio.json. With none set the button never
 * appears, which is the state the site ships in.
 *
 * WHY A GLOBAL AND NOT A MODULE
 *
 * The same reason as assets/basemap.js and assets/pass.js, which several
 * pages share the same way: this site has no build step and no bundler, and a
 * classic script that sets one global needs neither. Load it before whichever
 * script mounts the button — both are `defer`, so document order is
 * execution order.
 *
 * IT KEEPS PLAYING WHEN YOU WALK TO ANOTHER PAGE
 *
 * The map and the lists are two documents, and a navigation between them
 * tears down the first one — audio element, stream and all. So the radio
 * used to stop dead the moment somebody went to look at a list, which is not
 * what a radio is: it plays until you turn it off.
 *
 * It cannot be the same element across the two, so it is the same *station
 * and the same intent*: on or off is written to sessionStorage, every page
 * that mounts the button reads it, and one that finds the radio on joins the
 * stream where it now is. A live stream has no position to resume from, so
 * there is nothing else to carry — the couple of hundred milliseconds it
 * takes to reconnect is the whole of the seam.
 *
 * sessionStorage and not localStorage, deliberately. The tab that was playing
 * keeps playing; a visit tomorrow opens silent. Autoplay is blocked in every
 * browser and should be — a map that starts making noise on its own is a map
 * people close — and this only ever plays because somebody pressed it during
 * this same visit.
 *
 * WHICH IS STILL NOT ENOUGH FOR THE BROWSER
 *
 * A fresh document has no gesture behind it, so play() on arrival is refused
 * unless the browser has decided the site is one this person plays sound on.
 * Chrome usually has by then; Safari and Firefox usually have not. A refusal
 * is not a failure here — the visitor did press play, one page ago — so the
 * button stays on, and the stream is started by the first tap or keypress
 * anywhere on the new page. See waitForGesture(), and its note on which
 * half of a tap the browser counts.
 *
 * AND THE BUTTON FOLLOWS THE ELEMENT, NOT ONLY THE OTHER WAY ROUND
 *
 * A phone call pauses whatever is playing. So does the pause button on the
 * lock screen, and so does pulling the headphones out. None of those comes
 * through this file: the browser pauses the element itself, and for a while
 * the button went on showing the radio on over a stream that had stopped,
 * until somebody pressed it twice to get it back. Whether the stream comes
 * back on its own depends on the phone — Chrome on Android picks it up again
 * once the call ends, Safari on an iPhone leaves it paused — so nothing here
 * guesses. The element says when it has been paused and when it is playing
 * again, and the switch follows it both ways: off on the pause, on again if
 * the browser or the lock screen brings it back, and otherwise one press,
 * which rejoins the stream live. See interrupted() and resumed().
 */
window.TTBRadio = (function () {
  'use strict';

  /* From the root: lists.html is also served at /list/<id>, where a relative
     "data/radio.json" would ask for /list/data/radio.json and 404. */
  var SOURCE = '/data/radio.json';
  var KEY = 'ttb.radio';

  var stations = null;      // data/radio.json, once it has arrived
  var audio = null;
  var armed = false;        // whether a gesture is being waited for

  /* Is the radio on? Not "is sound coming out" — see the head of this file:
     between arriving on a page and the browser letting the stream start, the
     radio is on and silent. The button follows this, because this is what
     pressing it again would turn off. */
  var wanted = false;

  /* What the page mounted: its button, the span the station's name goes in,
     the language it is reading in, its translator and its ear. mount() fills
     all five in and none of them is optional — see the note above it. */
  var btn = null;
  var nameEl = null;
  var lang = '';
  var say = null;
  var told = null;

  function readWanted() {
    try { return window.sessionStorage.getItem(KEY) === 'on'; } catch (e) { return false; }
  }

  function writeWanted() {
    try { window.sessionStorage.setItem(KEY, wanted ? 'on' : 'off'); } catch (e) { /* private mode */ }
  }

  /* One station per language where there is one, and the default everywhere
     else. A visitor reading the map in Russian gets Наше Радио rather than a
     station they cannot follow, and nobody gets silence for want of an entry. */
  function stationFor(code) {
    if (!stations) return null;
    var byLang = stations.byLanguage || {};
    return byLang[code] || stations['default'] || null;
  }

  function paint() {
    var station = stationFor(lang);
    if (!station || !station.url) { btn.hidden = true; return; }
    btn.hidden = false;
    nameEl.textContent = station.name || '';
    btn.setAttribute('aria-pressed', String(wanted));
    var label = say(wanted ? 'radioStop' : 'radioPlay');
    btn.setAttribute('aria-label', label);
    btn.setAttribute('title', label);
  }

  function halt() {
    if (audio) { audio.pause(); audio.removeAttribute('src'); audio.load(); }
  }

  /* A refusal to autoplay is answered by the next thing the visitor does,
     whatever it is: any tap or key is a gesture, and this stream is one the
     browser has already been told about, so it starts on that gesture rather
     than on a second press of a button that is already showing as on.

     The end of the tap, not the start of it. A finger going down is not a
     gesture to the browser: the events that count as one are keydown,
     mousedown, pointerup and touchend, and pointerdown only when it comes
     from a mouse. This listened for pointerdown, and a browser that holds to
     that list — Safari on an iPhone is the one that matters — refused the
     play() from it exactly as it had refused the one on arrival, which armed
     this again for the next tap, which failed the same way. So on a phone
     the radio never came back after a walk to another page, though the
     button said it was on, and the only way out was to press it off and on.
     Chrome counts the finger going down as well, which is why it looked
     fine on Android and on every desktop.

     Capture, so a handler that stops the event on its way down does not also
     stop the radio, and one-shot on both listeners together — whichever fires
     first takes the other one with it. */
  function waitForGesture() {
    if (armed) return;
    armed = true;
    var go = function () {
      document.removeEventListener('pointerup', go, true);
      document.removeEventListener('keydown', go, true);
      armed = false;
      if (wanted) start();
    };
    document.addEventListener('pointerup', go, true);
    document.addEventListener('keydown', go, true);
  }

  /* A stream that would not start, or that has stopped: an error, a play()
     that was refused for any reason but the gesture, or a live stream ending,
     which is its server hanging up. Every way in here can arrive after the
     visitor has already turned the radio off — detaching the source raises
     an error event of its own — and a toast about a stream nobody is waiting
     for any more is a toast about nothing. So a radio that is already off
     says nothing and stays off. */
  function fail() {
    if (!wanted) return;
    halt();
    wanted = false;
    writeWanted();
    paint();
    told('fail');
  }

  /* Paused by something that is not a press: a phone call, the lock screen,
     the headphones coming out. The element has stopped and the browser may or
     may not start it again, so the switch follows the element rather than
     guessing — off, and the button says so — and resumed() turns it back on
     if the browser does.

     `paused` is what tells these apart from the pauses this file causes. A
     press to stop turns the switch off before it pauses anything, so `wanted`
     is already false when the event comes round. Re-attaching the stream in
     start() pauses the element for as long as it takes to set the new source,
     and the play() right after has it going again before the event is
     delivered, so `paused` is false by then. And a stream that runs out
     pauses itself on the way to `ended`, with `ended` already true when the
     pause is delivered; that one is a failure, with a toast, and fail() has
     it. Only a pause from outside leaves the element paused and not ended.

     The page is not told. Its onchange is for a press and for a stream that
     failed, and this is neither: nothing to close, nothing to count. */
  function interrupted() {
    if (!wanted || !audio.paused || audio.ended) return;
    wanted = false;
    writeWanted();
    paint();
  }

  /* And back on from outside: the lock screen's play button, or Chrome on
     Android picking the stream up again once a call has ended. Our own
     start() raises this too, with the switch already on, and is ignored. */
  function resumed() {
    if (wanted) return;
    wanted = true;
    writeWanted();
    paint();
  }

  function start() {
    var station = stationFor(lang);
    if (!station || !station.url) return;

    if (!audio) {
      audio = document.createElement('audio');
      audio.preload = 'none';
      audio.addEventListener('error', fail);
      audio.addEventListener('ended', fail);
      audio.addEventListener('pause', interrupted);
      audio.addEventListener('play', resumed);
    }
    /* A live stream has no position to resume from, so it is re-attached
       rather than un-paused: pressing play always joins it where it is now. */
    audio.src = station.url;
    var started = audio.play();
    if (started && started.catch) {
      started.catch(function (err) {
        /* Two rejections are not the stream's fault.

           AbortError is this file's own doing. A play() that has not settled
           yet — a live stream takes a second or two to connect — is rejected
           the moment the element's source is taken away from under it, and
           the two things that do that are halt() and a second start(). After
           halt() the switch is already off and fail() would ignore it. After
           a second start() it is not: switching language a moment after
           pressing play used to land here with the new station already
           connecting, and fail() answered by tearing that one down, turning
           the switch off and toasting that the stream would not start. It
           had started. Nothing is left to do — whichever start() came last
           is the one playing, and if it is not, its own promise says so.

           NotAllowedError is the browser refusing a sound nobody had asked
           for on this page yet, and the only one worth waiting on: somebody
           asked on the last page. */
        if (err && err.name === 'AbortError') return;
        if (err && err.name === 'NotAllowedError') waitForGesture();
        else fail();
      });
    }
  }

  function toggle() {
    var station = stationFor(lang);
    if (!station || !station.url) return;
    wanted = !wanted;
    writeWanted();
    if (wanted) start(); else halt();
    paint();
    told(wanted ? 'play' : 'stop', station);
    /* Reported from here rather than by each page's onchange, so every page
       that mounts the button counts the press the same way. */
    TTBTrack.event(wanted ? 'radio_play' : 'radio_stop', { station: station.name || 'radio' });
  }

  /* Fetched as this file runs rather than when the button is mounted. It is
     one small file, the page has a boot's worth of other requests in flight
     beside it, and on the map the rail introduces itself on a timer that will
     not wait for a late station name.

     Optional in every sense: no file, no station, no button, and the rest of
     the page does not notice. */
  var loading = fetch(SOURCE, { headers: { accept: 'application/json' } })
    .then(function (res) { return res.ok ? res.json() : null; })
    .catch(function () { return null; })
    .then(function (loaded) { stations = loaded; });

  /* The page hands over its button, the words to put on it and somewhere to
     send the news; this takes over from there, the press included.

     `onchange` is for what a page does around the radio rather than to it —
     the map opens the station's name on the rail, every page toasts a stream
     that would not start. It is not called for the
     resume across a navigation, because nothing changed: the radio was on
     when the last page was left and it is on now. Only a press, or a stream
     failing, is news. */
  function mount(opts) {
    btn = opts.button;
    nameEl = opts.name;
    lang = opts.lang;
    say = opts.t;
    told = opts.onchange;
    wanted = readWanted();

    btn.addEventListener('click', toggle);

    loading.then(function () {
      paint();
      /* Where the radio comes back after a navigation. Nothing else happens
         here: the button was already showing as on, because it is. */
      if (wanted) start();
    });
  }

  /* Changing language mid-song changes the station under it, rather than
     leaving the old one playing behind a button naming the new one. */
  function language(code) {
    if (code === lang) return;
    lang = code;
    if (wanted) start();
    paint();
  }

  /* Off, at the page's asking rather than the visitor's: the map stops the
     radio when a story opens, because two things playing at once is one too
     many. The switch goes with it, so it is still off on the next page — a
     radio turned down for a story was not turned down for that page. Nothing
     is reported back; the page that asked already knows. */
  function stop() {
    if (!wanted) return;
    wanted = false;
    writeWanted();
    halt();
    paint();
  }

  return { mount: mount, language: language, stop: stop };
})();
