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
 * and the same intent*: on or off, and the station that was playing, are
 * written to sessionStorage, and the next page rejoins the stream where it
 * now is. A live stream has no position to resume from, so there is nothing
 * else to carry.
 *
 * That is the walk that starts on a page. A walk that starts on the map no
 * longer leaves the map's document at all: assets/shell.js opens the page in
 * a frame over the map, and this file, running in that frame, does nothing
 * of its own — see A PAGE INSIDE THE MAP below. The carry across documents
 * is what is left for the other direction, a fresh load of a page, and the
 * back button.
 *
 * It rejoins the moment this file runs, not when the page gets round to
 * mounting the button. Every page mounts it after its own data is in — the
 * account page after ui.json, the catalogue and two answers from the
 * database, the map after the whole catalogue — and for a while the radio
 * waited on all of that too, so the silence between two pages was the
 * second page's whole boot rather than the reconnect. The station is the
 * only thing the rejoin needs, and the last page wrote it down; the button
 * catches up when the page mounts it, and if the page turns out to be
 * reading in a language with a station of its own, the station changes
 * under it then, the way a language switch changes it. What is left of the
 * seam is the navigation itself and the stream connecting, and neither is
 * this file's to shorten: a page is a document, and a document that goes
 * takes its <audio> with it.
 *
 * The browser pauses the element on the way out, and the back button can
 * bring the first document back with its paused element still in it. Neither
 * is a press, and neither is a phone call either — see THE PAGE ON ITS WAY
 * OUT, AND BACK by the pagehide listener at the foot of this file.
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
 * anywhere on the new page, the button included. See waitForGesture(), its
 * note on which half of a tap the browser counts, and why the one press it
 * hands to toggle() is a press of the button itself.
 *
 * The first tap, and not the first one that happens to arrive late enough.
 * For the first moments of a page there is a wait with nothing to end it:
 * data/radio.json is still in the air, and the page has not yet said which
 * language it reads in, so asking which station to play gets no answer, or
 * gets the default station rather than the one that was actually playing.
 * Both of those are answered from what the last page wrote down — the same
 * thing the rejoin starts from — and a tap that still has nothing to start
 * leaves the listeners on for the next one rather than spending the wait.
 * See gesture() and stationNow().
 *
 * What no listener can answer is a page somebody only reads. A finger that
 * scrolls is not a tap: the browser takes the pointer for itself and the
 * sequence ends in pointercancel, so there is no pointerup to hear, and a
 * play() hung off the touchend it does send was refused too where this was
 * measured, which was Chromium. So a visitor who lands on a list and only
 * scrolls hears nothing until they touch something. That is the browser's
 * rule about sound and not this file's to route around; what this file owes
 * them is that the first press of the switch they are looking at brings the
 * music back rather than turning it off.
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
 *
 * A PAGE INSIDE THE MAP
 *
 * assets/shell.js opens every page a visitor walks to from the map in a
 * frame over the map, and the map goes on playing underneath. A page in that
 * frame loads this file like any other, and for a while that was two radios:
 * the frame's own read 'on' from sessionStorage — the same origin, the same
 * store — and rejoined the stream beside the one already playing. So this
 * file looks up first, and in a frame whose parent is this site it keeps no
 * station list, no element and no switch: mount() hands the page's button to
 * the parent's radio through adopt(), language() and stop() are the parent's,
 * and what the page gets is its own button on its own header, painted by the
 * one radio that is playing. The parent paints it from the first frame, as
 * preshow() does on a page of its own, and lets go of it when the page's
 * document goes. A page's language is a station like the map's, and the
 * map's own comes back when the page closes.
 *
 * One thing the frame keeps to itself: a tap on the page inside it is the
 * page's document's and never reaches the listeners waitForGesture() puts
 * on this one, so a rejoin the map's browser refused is not started by
 * tapping around a page open over it. The page's button is, through
 * toggle(), which is the press that wait was written to hand over anyway.
 */
window.TTBRadio = (function () {
  'use strict';

  /* In a frame on this site: the parent's radio, and nothing of this file's
     own. A parent on another origin cannot be read and throws, which is the
     catch; that page is then a page of its own, as every page is in a tab. */
  var host = null;
  try {
    if (window.parent !== window && window.parent.TTBRadio && window.parent.TTBRadio.adopt) host = window.parent.TTBRadio;
  } catch (e) { host = null; }
  if (host) {
    var lend = function () {
      var el = document.getElementById('btn-radio');
      if (el) host.adopt({ button: el, name: document.getElementById('radio-name'), lang: '', t: null, onchange: null }, window);
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', lend);
    else lend();
    return {
      mount: function (opts) { host.adopt(opts, window); },
      language: function (code) { host.language(code); },
      stop: function () { host.stop(); }
    };
  }

  /* From the root: lists.html is also served at /list/<id>, where a relative
     "data/radio.json" would ask for /list/data/radio.json and 404. */
  var SOURCE = '/data/radio.json';
  var KEY = 'ttb.radio';
  var STATION_KEY = 'ttb.radio.station';
  var NAME_KEY = 'ttb.radio.name';

  var stations = null;      // data/radio.json, once it has arrived
  var audio = null;
  var armed = false;        // whether a gesture is being waited for

  /* True from pagehide until pageshow: the page is being left, or is held
     in the browser's back-forward cache. Nothing the element says in that
     window is about the radio — see THE PAGE ON ITS WAY OUT below. */
  var leaving = false;

  /* The URL attached to the element and meant to be playing, or '' once it
     has been taken off or the browser has paused it from outside. What
     tune() reads to leave a stream alone that is already the one asked for:
     the rejoin that ran as this file loaded, and the page's own start() a
     second later, are one stream, not two. */
  var current = '';

  /* Is the radio on? Not "is sound coming out" — see the head of this file:
     between arriving on a page and the browser letting the stream start, the
     radio is on and silent. The button follows this, because this is what
     pressing it again would turn off. */
  var wanted = false;

  /* What the pages mounted: for each, its button, the span the station's
     name goes in, its translator, its ear and its window. The first is this
     page's own, from mount(); the rest are pages open in a frame over it,
     from adopt(), each let go of when its document goes. A translator or an
     ear can be null on a button lent before its page has its words — see
     A PAGE INSIDE THE MAP at the head of this file. */
  var mounted = [];

  /* The language the radio plays for: this page's own from mount(), or the
     last one a framed page spoke. ownLang is this page's, to come back to
     when that page closes. */
  var lang = '';
  var ownLang = '';

  function readWanted() {
    try { return window.sessionStorage.getItem(KEY) === 'on'; } catch (e) { return false; }
  }

  function writeWanted() {
    try { window.sessionStorage.setItem(KEY, wanted ? 'on' : 'off'); } catch (e) { /* private mode */ }
  }

  /* The URL that was playing, for the next page to rejoin before it has read
     anything. Only the URL: the button takes the name from radio.json when
     the page mounts it, the same as after a press. */
  function readStation() {
    try {
      var url = window.sessionStorage.getItem(STATION_KEY);
      return url ? { url: url, name: window.sessionStorage.getItem(NAME_KEY) || '' } : null;
    } catch (e) { return null; }
  }

  function writeStation(station) {
    try {
      window.sessionStorage.setItem(STATION_KEY, station.url);
      window.sessionStorage.setItem(NAME_KEY, station.name || '');
    } catch (e) { /* private mode */ }
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
    /* Until data/radio.json has arrived the button is drawn from the station
       the last page wrote down, so it is on screen, named and in the right
       state from the first frame of a new page instead of appearing a beat
       later: a page walked to should look like the one walked from. Only a
       radio that is on has one to draw; a visitor who never pressed it sees
       the button arrive with the file, as before. */
    var station = stations ? stationFor(lang) : (wanted ? readStation() : null);
    for (var i = 0; i < mounted.length; i++) {
      var m = mounted[i];
      /* A frame taken down says pagehide and release() hears it; a window
         that is closed all the same is let go of here, so that nothing is
         painted on a button in a document that has gone. */
      if (m.win !== window && m.win.closed) { mounted.splice(i, 1); i--; continue; }
      if (!station || !station.url) { m.button.hidden = true; continue; }
      m.button.hidden = false;
      if (m.name) m.name.textContent = station.name || '';
      m.button.setAttribute('aria-pressed', String(wanted));
      /* A button lent before its page has its words keeps the label the
         markup gave it; the page's mount() brings the right one. */
      if (!m.say) continue;
      var label = m.say(wanted ? 'radioStop' : 'radioPlay');
      m.button.setAttribute('aria-label', label);
      m.button.setAttribute('title', label);
    }
  }

  /* The news: a press, to the page whose button was pressed, and a stream
     that failed, to every page that mounted an ear — each toasts on its own
     screen, and whichever is on top is the one that is read. */
  function tell(what, station, button) {
    for (var i = 0; i < mounted.length; i++) {
      if (button && mounted[i].button !== button) continue;
      if (mounted[i].told) mounted[i].told(what, station);
    }
  }

  /* Whether a press landed on one of the buttons, which is toggle()'s and
     not gesture()'s — see waitForGesture(). */
  function onButton(node) {
    for (var i = 0; i < mounted.length; i++) {
      if (mounted[i].button.contains(node)) return true;
    }
    return false;
  }

  function halt() {
    current = '';
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

     EXCEPT A PRESS OF THE BUTTON, WHICH IS TOGGLE'S

     The one press this must not answer is the obvious one. Somebody looking
     at a switch that says on over silence presses the switch, and a press is
     a pointerup before it is a click — so this listener started the stream,
     and the click a moment later turned the radio off, aborting the play()
     it had just made. One press for a frame of sound and an off switch; two
     to actually hear anything, which is the same trap the pointerdown
     version of this left on an iPhone and is what a walk from the map to a
     list ran into every time the browser refused the rejoin.

     So a press that lands on the button is left alone here and answered in
     toggle(), where the radio knows it is on and silent and can start the
     stream instead of stopping it. Every other tap and key on the page is
     this listener's, exactly as before.

     Capture, so a handler that stops the event on its way down does not also
     stop the radio. */
  function waitForGesture() {
    if (armed) return;
    armed = true;
    document.addEventListener('pointerup', gesture, true);
    document.addEventListener('keydown', gesture, true);
  }

  /* Any tap or key that is not the button: the wait is over and the stream
     starts on it. A named function rather than a closure because the wait
     ends in two places — here and in toggle() — and both have to be able to
     take these listeners off again.

     A TAP WITH NOTHING TO START ON DOES NOT END THE WAIT

     This took the listeners off first and asked what to play second, and on
     a page that has only just arrived the answer is often "nothing yet":
     stationNow() reads data/radio.json, which is still in the air for the
     first few hundred milliseconds of every page. A tap that landed in that
     window started nothing and spent the wait, and the music then waited for
     the page to mount the button — the map spends its whole catalogue there
     — which is the silence the early rejoin exists to avoid. It did come
     back: the spent tap leaves the document with a gesture behind it, so the
     page's own start() is allowed when it finally runs. It came back late.
     Measured in Chromium against a station answering in 200ms, touching the
     page 150ms in with the button mounting at two seconds: 2.06s from the
     touch to the music, against 0.26s once the tap is the thing that starts
     it.

     So the station is asked for first, and a tap with no answer yet leaves
     the listeners where they are for the next one. */
  function gesture(ev) {
    if (ev.target && onButton(ev.target)) return;
    if (!wanted) { stopWaiting(); return; }
    var station = stationNow();
    if (!station || !station.url) return;
    stopWaiting();
    tune(station);
  }

  function stopWaiting() {
    if (!armed) return;
    armed = false;
    document.removeEventListener('pointerup', gesture, true);
    document.removeEventListener('keydown', gesture, true);
  }

  /* A stream that would not start, or that has stopped: an error, a play()
     that was refused for any reason but the gesture, or a live stream ending,
     which is its server hanging up. Every way in here can arrive after the
     visitor has already turned the radio off — detaching the source raises
     an error event of its own — and a toast about a stream nobody is waiting
     for any more is a toast about nothing. So a radio that is already off
     says nothing and stays off.

     Before the page has mounted the button there is nobody to tell and
     nothing to paint: the switch goes off, and the page finds it off when it
     mounts. */
  function fail() {
    if (!wanted || leaving) return;
    halt();
    wanted = false;
    writeWanted();
    paint();
    tell('fail');
  }

  /* Paused by something that is not a press: a phone call, the lock screen,
     the headphones coming out. The element has stopped and the browser may or
     may not start it again, so the switch follows the element rather than
     guessing — off, and the button says so — and resumed() turns it back on
     if the browser does.

     `paused` is what tells these apart from the pauses this file causes. A
     press to stop turns the switch off before it pauses anything, so `wanted`
     is already false when the event comes round. Re-attaching the stream in
     tune() pauses the element for as long as it takes to set the new source,
     and the play() right after has it going again before the event is
     delivered, so `paused` is false by then. And a stream that runs out
     pauses itself on the way to `ended`, with `ended` already true when the
     pause is delivered; that one is a failure, with a toast, and fail() has
     it. Only a pause from outside leaves the element paused and not ended.

     The page is not told. Its onchange is for a press and for a stream that
     failed, and this is neither: nothing to close, nothing to count. */
  function interrupted() {
    if (!wanted || leaving || !audio.paused || audio.ended) return;
    current = '';
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

  /* Which station to play, which depends on how far the page has got.

     Once it has said which language it reads in, its own: somebody reading
     the map in Russian gets Наше Радио. Before it has, there is no language
     to ask with — and stationFor('') is not "no answer", it is the default
     station, because that is what the fallback is for. So a tap that came
     in before the page mounted the button answered a visitor reading in
     Russian with Raadio Tallinn, and then, a second or two later when
     mount() finally said 'ru', swapped the station out from under them: a
     stutter, a strange station, and two connections where one was asked
     for.

     The last page already wrote down the station that was playing, and the
     rejoin at the foot of this file starts from it. Until this page has
     spoken, so does this: the same answer, and one that needs no fetch to
     have landed. */
  function stationNow() {
    return lang ? stationFor(lang) : readStation();
  }

  function start() {
    var station = stationNow();
    if (station && station.url) tune(station);
  }

  function build() {
    audio = document.createElement('audio');
    audio.preload = 'none';
    audio.addEventListener('error', fail);
    audio.addEventListener('ended', fail);
    audio.addEventListener('pause', interrupted);
    audio.addEventListener('play', resumed);
  }

  /* The element let go of, with nothing left listening to it. Whatever it
     still has to say — the error for a source taken away, the pause the
     browser gave it in the cache — lands on nobody, and the next tune()
     builds a fresh one. */
  function discard() {
    if (!audio) return;
    var old = audio;
    audio = null;
    current = '';
    old.removeEventListener('error', fail);
    old.removeEventListener('ended', fail);
    old.removeEventListener('pause', interrupted);
    old.removeEventListener('play', resumed);
    old.pause();
    old.removeAttribute('src');
    old.load();
  }

  /* Join a station live. One that is attached and meant to be playing is
     left alone — see `current` — so a second call for the same station is
     not a second connection. */
  function tune(station) {
    if (station.url === current) return;
    current = station.url;
    writeStation(station);

    if (!audio) build();
    /* A live stream has no position to resume from, so it is re-attached
       rather than un-paused: pressing play always joins it where it is now. */
    audio.src = station.url;
    var started = audio.play();
    if (started && started.then) {
      started.then(function () {
        /* Playing, so there is nothing left to wait for. Without this the
           wait outlived the silence it was waiting on: the rejoin is
           refused and arms it, and then the page's own start() a moment
           later is allowed — Chrome decides between one play() and the next
           that this is a site the visitor plays sound on — so the stream
           came up with the wait still standing. toggle() then read the next
           press as the gesture that branch exists for, and since the radio
           was already sounding, the press did nothing at all: two presses to
           stop a radio, which is the trap that branch was written to close,
           met coming the other way. */
        stopWaiting();
      }, function (err) {
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
           asked on the last page. The station comes off `current` so that
           the gesture's start() attaches it again rather than finding it
           already there and leaving it, refused, where it is. */
        if (err && err.name === 'AbortError') return;
        if (err && err.name === 'NotAllowedError') { current = ''; waitForGesture(); }
        else fail();
      });
    }
  }

  function toggle() {
    var station = stationFor(lang);
    if (!station || !station.url) return;

    /* On and silent, which is a radio waiting for a gesture on a page it
       arrived already playing — see waitForGesture(). This press is that
       gesture, so it is a press for the sound rather than against it: the
       stream starts and the switch stays where it is. Turning it off here is
       what the button used to do, and it made "press the radio to get the
       music back" the thing that stopped it.

       And it really is silent: a play() that succeeds ends the wait, so this
       branch cannot be reached over a stream that is already running. It
       could once, and the press vanished into it — see tune().

       Nothing is reported. The radio was on before this press and it is on
       after it, and onchange is for a press that changed something. */
    if (wanted && armed) {
      stopWaiting();
      start();
      return;
    }

    wanted = !wanted;
    writeWanted();
    if (wanted) start(); else halt();
    paint();
    /* Told to the page whose button this was: a press on a page open over
       the map is that page's news, and a hint opening on the map under it
       would be a hint opening under a sheet. */
    tell(wanted ? 'play' : 'stop', station, this);
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

  /* THE PAGE ON ITS WAY OUT, AND BACK

     Leaving a page pauses its element, and the browser does that itself
     before the document is torn down, or before it is put in the
     back-forward cache for the back button to bring back. On a desktop that
     pause was heard here as one from outside — a phone call, the lock
     screen — and interrupted() answered it the way it answers those: switch
     off, and 'off' written to sessionStorage. So the next page read 'off'
     and arrived silent with the button showing the radio stopped, which is
     exactly the walk this file exists to carry the music across. Nothing the
     element says between pagehide and pageshow is about the radio, so none
     of it is listened to.

     Coming back from the cache is the other half. The document is restored
     as it was, this file does not run again, and the rejoin below has
     already happened once: so the element it holds is the one the browser
     paused on the way out, over a stream connection that has had seconds or
     minutes to die, and the switch is whatever it was when the page was
     left — which the page walked to may since have changed. Both are read
     afresh: the switch from sessionStorage, and a radio that is on rejoins
     the stream live on a new element, a refusal waiting for a gesture as
     the rejoin on arrival does. The old element is discarded, listeners and
     all, so a late pause or error from it cannot turn off the stream that
     replaced it. A radio turned off on the other page is turned off here
     too, before the browser can un-pause the old element on its own. */
  window.addEventListener('pagehide', function () {
    leaving = true;
    stopWaiting();
  });
  window.addEventListener('pageshow', function (ev) {
    if (!leaving) return;
    leaving = false;
    if (!ev.persisted) return;
    discard();
    wanted = readWanted();
    if (wanted) start(); else paint();
  });

  /* Where the radio comes back after a navigation: as this file runs, from
     the station the last page wrote down, before this page has fetched a
     thing of its own. See the head of this file. A tab from before the
     station was written down has the switch and no station, and waits for
     the page to mount the button as it always did. */
  wanted = readWanted();
  if (wanted) {
    var last = readStation();
    if (last) tune(last);
  }

  /* The button on screen before the page has mounted it. Every page mounts
     after its own data is in, which on the map is the whole catalogue, so a
     radio that was playing on the last page used to arrive without its
     button for that long and then pop in: the one part of the screen that
     should have stayed where it was. The markup already carries the button,
     hidden, with its icons and its translated labels; all that is missing
     is the station's name and the state, and the last page wrote both down.
     mount() paints over it with the real thing. */
  function preshow() {
    var el = document.getElementById('btn-radio');
    var last = wanted ? readStation() : null;
    if (!el || mounted.length || !last) return;
    el.hidden = false;
    el.setAttribute('aria-pressed', 'true');
    var label = document.getElementById('radio-name');
    if (label) label.textContent = last.name || '';
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', preshow);
  else preshow();

  /* The page hands over its button, the words to put on it and somewhere to
     send the news; this takes over from there, the press included.

     `onchange` is for what a page does around the radio rather than to it —
     the map opens the station's name on the rail, every page toasts a stream
     that would not start. It is not called for the resume across a
     navigation, because nothing changed: the radio was on when the last page
     was left and it is on now. Only a press, or a stream failing, is news. */
  function mount(opts) {
    ownLang = opts.lang;
    lang = opts.lang;
    hold(opts, window);

    loading.then(function () {
      paint();
      /* The button catching up with a radio that is already on. Where the
         rejoin above found the page's own station this does nothing; where
         it found none, or the page reads in a language with a station of
         its own, this is where the right one starts. */
      if (wanted) start();
    });
  }

  /* A button taken on: this page's own, or a framed page's. One entry per
     window — a page lends its button bare as it loads and mounts it again
     with its words, and the second replaces the first. */
  function hold(opts, win) {
    var entry = { button: opts.button, name: opts.name, say: opts.t, told: opts.onchange, win: win };
    var at = mounted.length;
    for (var i = 0; i < mounted.length; i++) {
      if (mounted[i].win !== win) continue;
      mounted[i].button.removeEventListener('click', toggle);
      at = i;
    }
    mounted[at] = entry;
    entry.button.addEventListener('click', toggle);
    paint();
  }

  /* A page open in a frame over this one hands its button over — see A PAGE
     INSIDE THE MAP at the head of this file. Its language is a station the
     way a switch is, and this page's comes back when the page's document
     goes: pagehide is what a frame's document says on its way out, whether
     the page walked on or the frame was taken down. One listener per
     document: the bare lend adds it, the page's own mount() finds the entry
     already there. release() takes the entry out, so the next document in
     the same frame is new again. */
  function adopt(opts, win) {
    var known = false;
    for (var i = 0; i < mounted.length; i++) if (mounted[i].win === win) known = true;
    hold(opts, win);
    if (opts.lang) language(opts.lang);
    if (!known) win.addEventListener('pagehide', function () { release(win); });
  }

  function release(win) {
    for (var i = mounted.length - 1; i >= 0; i--) {
      if (mounted[i].win === win) mounted.splice(i, 1);
    }
    language(ownLang);
    paint();
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

  return { mount: mount, adopt: adopt, language: language, stop: stop };
})();
