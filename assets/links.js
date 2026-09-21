/* Tallinn Tastebuds — the three places somebody can say they are.
 *
 * Instagram, TikTok, Facebook, written under the line on /u/<name> and edited
 * on /account.html. Two pages draw them, which is why this is a file of its
 * own rather than a table inside one of them — the same arrangement
 * assets/pins.js has, and for the same reason: a second copy is a second
 * thing to move.
 *
 * WHAT IS STORED IS A HANDLE, AND THE ADDRESS IS BUILT
 *
 * Nothing here ever holds a URL somebody typed. A profile is the one page on
 * this site that links off it, and a field that took an address would be a
 * field for pointing anywhere at all from under a name a reader has come to
 * trust because of the lists beneath it. So the field takes a handle, the
 * base comes out of the table below, and url() is the only thing that puts
 * the two together. What somebody pastes is read for its handle — people
 * paste addresses, and refusing one they copied off their own profile would
 * be the site being difficult about its own rule.
 *
 * THE SAME TABLE IS ON THE SERVER
 *
 * functions/api/_profile.js holds these three rows too, because the server is
 * what decides whether a handle is one before it is stored. Neither file can
 * import the other — that is ESM on the Workers runtime, this is ES5 served
 * raw to the browser — so they are written out twice and node
 * tools/validate.mjs fails the build when they drift. Change one, change the
 * other.
 *
 * THE CAP IS THE PATTERN, AND THE FIELD HAS NO MAXLENGTH
 *
 * Every other field on this site restates its cap as a maxlength, so somebody
 * is stopped at the keystroke rather than at the round trip. These three must
 * not, and it cost a browser pass to find out: the field takes a pasted
 * address as well as a handle, an Instagram profile URL is fifty characters
 * before the handle starts, and a maxlength of 30 cut it to
 * `https://www.instagram.com/tall` — which parses, points at somebody else,
 * and looks for all the world like it worked. So the length lives in each
 * pattern below, the field holds whatever was pasted, and what it is worth is
 * settled on the way out: clean() on blur, which puts the handle in the box
 * so that what somebody sees is what is about to be stored. The pattern is
 * what is written out twice and what the validator compares.
 */
window.TTBLinks = (function () {
  'use strict';

  /* In the order the form draws them and the profile prints them, which is
     the order somebody is likeliest to have one: the site this city's
     restaurants live on first, and the one that is a page rather than a
     person last. */
  var NETWORKS = [
    { id: 'instagram', label: 'Instagram', base: 'https://www.instagram.com/', hosts: ['instagram.com'], re: /^[A-Za-z0-9._]{1,30}$/, at: true },
    /* The @ belongs to the address, not to the handle: what is stored is the
       same shape for all three and only one of them wears it. */
    { id: 'tiktok', label: 'TikTok', base: 'https://www.tiktok.com/@', hosts: ['tiktok.com'], re: /^[A-Za-z0-9._]{1,24}$/, at: true },
    /* No underscore, and five characters at the shortest — Facebook's own
       shape. `profile.php` fits it and is not a username; it is the numeric
       address with the number left behind. */
    { id: 'facebook', label: 'Facebook', base: 'https://www.facebook.com/', hosts: ['facebook.com', 'fb.com'], re: /^[A-Za-z0-9.]{5,50}$/, deny: /^profile\.php$/i, at: false }
  ];

  function net(id) {
    for (var i = 0; i < NETWORKS.length; i++) if (NETWORKS[i].id === id) return NETWORKS[i];
    return null;
  }

  /* One handle, or '' — which means both "empty" and "not a handle", the same
     as the server's. The account form tells them apart by what it was given,
     so that a field somebody filled in is never quietly emptied.

     A pasted address has to be on the site the field is for, and only its
     first path segment survives: a link to one post becomes a link to the
     account it is on. */
  function clean(id, value) {
    var row = net(id);
    if (!row) return '';

    var raw = String(value == null ? '' : value).replace(/^\s+|\s+$/g, '');
    if (!raw) return '';

    if (raw.indexOf('/') >= 0) {
      var url;
      try {
        url = new URL(/^https?:\/\//i.test(raw) ? raw : 'https://' + raw);
      } catch (e) {
        return '';
      }
      var host = url.hostname.toLowerCase().replace(/^(?:www|m|web)\./, '');
      if (row.hosts.indexOf(host) < 0) return '';
      var parts = url.pathname.split('/');
      var first = '';
      for (var i = 0; i < parts.length && !first; i++) first = parts[i];
      try {
        raw = decodeURIComponent(first);
      } catch (e2) {
        raw = first;
      }
    }

    raw = raw.replace(/^@+/, '');

    if (!row.re.test(raw)) return '';
    /* Nothing but dots passes every pattern above and is what a stray paste
       of a domain leaves behind. */
    if (!/[A-Za-z0-9]/.test(raw)) return '';
    if (row.deny && row.deny.test(raw)) return '';
    return raw;
  }

  /* Where a handle points, built rather than stored. */
  function url(id, handle) {
    var row = net(id);
    return row && handle ? row.base + encodeURIComponent(handle) : '';
  }

  /* How a handle is printed: the way its owner says it out loud. Instagram
     and TikTok are both spoken with the @ and a Facebook username is not,
     which is `at` above — it is a fact about how each site writes a name
     rather than about its address, so it is not in the server's copy of this
     table and is not what the validator compares. */
  function shown(id, handle) {
    var row = net(id);
    return row && row.at ? '@' + handle : handle;
  }

  /* Every network a person actually filled in, in the table's order, as
     { id, label, href, shown } — a row ready to draw, so that neither page
     works anything out for itself and neither can work it out differently.

     It is the only way out of here besides clean() and the table: url() and
     shown() are what this builds a row with and have no caller of their own,
     so they are not handed out. */
  function of(links) {
    var out = [];
    if (!links) return out;
    NETWORKS.forEach(function (row) {
      var handle = clean(row.id, links[row.id]);
      if (!handle) return;
      out.push({
        id: row.id,
        label: row.label,
        href: url(row.id, handle),
        shown: shown(row.id, handle)
      });
    });
    return out;
  }

  return { NETWORKS: NETWORKS, clean: clean, of: of };
}());
