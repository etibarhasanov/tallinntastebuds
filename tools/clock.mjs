#!/usr/bin/env node
/**
 * Tallinn Tastebuds — the wall clock, and the window a story stands for.
 *
 * Every time written in the data is Tallinn wall clock, "2026-09-14T21:00":
 * nine in the evening in Tallinn, whatever the laptop writing the file is set
 * to. That is the only clock the person posting and the person watching are
 * both reading, so it is the one the file speaks.
 *
 * `assets/app.js` carries its own copy of this arithmetic, because the browser
 * cannot import a module out of tools/ and this site has no build step to fold
 * one in. The two are small, and they are the same: change one, change the
 * other, and the number below is the one that has to match.
 *
 * Zero dependencies, like everything else in tools/: `node tools/stories.mjs`
 * has to still run in five years with no `npm install` in front of it.
 */

/* ---------------------------------------------------------- the window
 * How long a story stands for when its entry does not say. A day and a half:
 * long enough that somebody who only opens the map in the evening still
 * catches a thing posted in the morning, short enough that the countdown is
 * the reason to open it now. Anything that is still worth watching next week
 * is not a story — it is a `reel` on the place itself.
 *
 * It is 36 real hours, not "a day and a half of dates", so a window that
 * steps over the night the clocks change is still 36 hours of the viewer's
 * life rather than 35 or 37 of them.
 */
export const STORY_HOURS = 36;
export const HOUR_MS = 3600000;

/* The offset Tallinn is on at a given instant. The offset depends on the
   instant and the instant is what we are working out, so it is applied twice:
   the first pass can be an hour out, and only inside the hour the clocks
   change, and the second settles it. */
function tallinnOffset(utcMs) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Tallinn', hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit'
  }).formatToParts(new Date(utcMs));
  const f = {};
  for (const p of parts) f[p.type] = p.value;
  const local = Date.UTC(Number(f.year), Number(f.month) - 1, Number(f.day),
                         Number(f.hour) % 24, Number(f.minute));
  return local - Math.floor(utcMs / 60000) * 60000;
}

export const STAMP_RE = /^([0-9]{4})-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])T([01][0-9]|2[0-3]):([0-5][0-9])$/;

export function isStamp(value) {
  return typeof value === 'string' && STAMP_RE.test(value);
}

/* "2026-09-14T21:00" -> the instant it names. NaN if it is not a stamp. */
export function tallinnTime(stamp) {
  const m = STAMP_RE.exec(String(stamp || ''));
  if (!m) return NaN;
  const wall = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]));
  return wall - tallinnOffset(wall - tallinnOffset(wall));
}

/* The instant -> the stamp a Tallinn clock would read at it. */
export function stampAt(ms) {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Europe/Tallinn', hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
  }).format(new Date(ms)).replace(' ', 'T');
}

export function nowStamp() { return stampAt(Date.now()); }

/* ------------------------------------------------------------ a story's run
 * One place decides when a story is up, and everything else asks it: the
 * validator, the queue tool, the viewer.
 *
 *   from + until   exactly what it says
 *   from only      36 hours from the moment it goes up  <- the usual one
 *   until only     up from now until then
 *   neither        not a story: nothing knows when it ends
 */
export function storyWindow(story) {
  const from = isStamp(story && story.from) ? story.from : null;
  let until = isStamp(story && story.until) ? story.until : null;
  if (!until && from) until = stampAt(tallinnTime(from) + STORY_HOURS * HOUR_MS);
  return {
    from,
    until,
    /* A story with no "from" is up the moment "live" is true, which is any
       instant at or before now. */
    fromMs: from ? tallinnTime(from) : -Infinity,
    untilMs: until ? tallinnTime(until) : NaN,
    /* True when the file said so rather than the default having said it. */
    explicit: isStamp(story && story.until)
  };
}

/* Where a story is in its own life, at a given instant. */
export function storyPhase(story, at = Date.now()) {
  const w = storyWindow(story);
  if (!(w.untilMs === w.untilMs)) return 'broken';
  if (story.live !== true) return 'draft';
  if (w.fromMs > at) return 'queued';
  if (w.untilMs <= at) return 'over';
  return 'up';
}
