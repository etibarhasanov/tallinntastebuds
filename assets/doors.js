/* Tallinn Tastebuds — the doors, drawn for the owner on /admin/doors.
 *
 * A door is a stretch somebody rode that the bike router can only join the
 * long way round, found in the kept rides by tools/doors.mjs and written to
 * data/doors.json, which functions/api/route.js sends a bike route through
 * where it wins. **Doors** in docs/handbook.md is the reasoning. Nowhere
 * else draws them, and on purpose: a door is not a path to show a stranger,
 * only a way a route may take. This page is so the owner can see what the
 * tool found — a door over a railway with no crossing is a line to take out
 * of the file by hand.
 *
 * It reads two files and no route: data/doors.json, and
 * data/doors-checked.json, where the tool keeps when it last looked, which
 * may not be there yet. So it costs no row of the database, and it is behind
 * the owner's lock only because it is under /admin/ — the files are public.
 *
 * Each door is a line on the map, its ends marked, and a row below with how
 * long it is and how far the router goes instead. Pressing a row takes the
 * map there; pressing a line says the same in a popup, with the place opened
 * on OpenStreetMap to check against what is drawn there.
 */
(function () {
  'use strict';

  var CENTRE = [59.437, 24.7536];
  var ZOOM = 12;

  var map = null;
  var lines = [];

  function el(tag, props, kids) {
    var node = document.createElement(tag);
    Object.keys(props || {}).forEach(function (k) {
      if (k === 'className') node.className = props[k];
      else if (k === 'textContent') node.textContent = props[k];
      else node.setAttribute(k, props[k]);
    });
    (kids || []).forEach(function (kid) {
      node.appendChild(typeof kid === 'string' ? document.createTextNode(kid) : kid);
    });
    return node;
  }

  function metres(n) {
    return n >= 1000 ? (n / 1000).toFixed(1) + ' km' : Math.round(n) + ' m';
  }

  function say(text) {
    document.getElementById('doors-state').textContent = text;
  }

  function getJson(url) {
    return fetch(url, { cache: 'no-store' }).then(function (res) {
      if (!res.ok) throw new Error(url + ' answered ' + res.status);
      return res.json();
    });
  }

  /* Where the door is, on OpenStreetMap, so what the router has there can
     be checked against what was ridden. */
  function osm(point) {
    return 'https://www.openstreetmap.org/?mlat=' + point[0] + '&mlon=' + point[1] + '#map=18/' + point[0] + '/' + point[1];
  }

  function words(door) {
    return metres(door.meters) + ' ridden, ' + metres(door.around) + ' by the router — ' +
      metres(door.around - door.meters) + ' saved';
  }

  function popup(door) {
    var box = el('div', { className: 'doors-pop' }, [
      el('strong', { textContent: door.id }),
      el('br'),
      words(door),
      el('br'),
      el('a', { href: osm(door.line[0]), target: '_blank', rel: 'noopener', textContent: 'Open on OpenStreetMap' })
    ]);
    return box;
  }

  function draw(doors) {
    var L = window.L;
    map = L.map('doors-map').setView(CENTRE, ZOOM);
    window.TTBBasemap.layer(L, { dark: false }).addTo(map);

    var bounds = [];
    doors.forEach(function (door) {
      var line = L.polyline(door.line, { color: '#c2410c', weight: 6, opacity: 0.85 }).addTo(map);
      L.circleMarker(door.line[0], { radius: 4, color: '#c2410c', fillOpacity: 1 }).addTo(map);
      L.circleMarker(door.line[door.line.length - 1], { radius: 4, color: '#c2410c', fillOpacity: 1 }).addTo(map);
      line.bindPopup(popup(door));
      lines.push(line);
      bounds = bounds.concat(door.line);
    });
    if (bounds.length) map.fitBounds(bounds, { padding: [24, 24] });
  }

  function list(doors) {
    var box = document.getElementById('doors-list');
    doors
      .map(function (door, i) { return { door: door, i: i }; })
      .sort(function (a, b) { return (b.door.around - b.door.meters) - (a.door.around - a.door.meters); })
      .forEach(function (row) {
        var go = el('button', { type: 'button', className: 'doors-row' }, [
          el('span', { className: 'doors-id', textContent: row.door.id }),
          el('span', { textContent: words(row.door) })
        ]);
        go.addEventListener('click', function () {
          map.fitBounds(lines[row.i].getBounds(), { padding: [60, 60], maxZoom: 17 });
          lines[row.i].openPopup();
          document.getElementById('doors-map').scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
        box.appendChild(el('li', {}, [go]));
      });
  }

  function boot() {
    if (!window.L || !window.TTBBasemap) {
      say('The map could not be loaded.');
      return;
    }
    Promise.all([
      getJson('/data/doors.json'),
      getJson('/data/doors-checked.json').catch(function () { return null; })
    ]).then(function (got) {
      var doors = (Array.isArray(got[0]) ? got[0] : []).filter(function (d) {
        return d && Array.isArray(d.line) && d.line.length > 1;
      });
      var checked = got[1] && got[1].at
        ? ' Rides looked at up to ' + new Date(got[1].at).toLocaleString('en-GB', { timeZone: 'Europe/Tallinn' }) + '.'
        : ' No run has saved where it stopped yet.';
      say(doors.length + ' doors.' + checked);
      draw(doors);
      list(doors);
    }).catch(function () {
      say('The doors could not be read.');
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
