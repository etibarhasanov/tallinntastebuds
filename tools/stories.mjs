#!/usr/bin/env node
/**
 * Tallinn Tastebuds — the story queue.
 *
 * A story is the one thing on this map that is not permanent, and this is the
 * script that makes that true without anybody having to be awake for it:
 *
 *     node tools/stories.mjs                  what is queued, what is up, what is over
 *     node tools/stories.mjs --schedule ...   put a photo in the queue for a day and a time
 *     node tools/stories.mjs --tick           do what the clock says is due
 *
 * `--tick` is what `.github/workflows/stories.yml` runs on the hour. Nothing
 * about it decides when a story is seen — `assets/app.js` reads the same
 * `from` and `until` out of `data/stories.json` and starts and stops the story
 * on the minute, in the viewer's own browser, with no deploy in between. The
 * cron is the other half of that: the backstop that pushes a commit when
 * something goes up or comes down, so the edge cache is refreshed at the hour
 * rather than whenever it felt like it, and the part that actually cleans up
 * afterwards.
 *
 * Coming down is where the work is. A photograph posted as a story was taken
 * at a place on this map, and when its day and a half is over the picture is
 * still a good picture — so it moves into `photos/<spot>/`, gets listed on the
 * place, and the story entry and the file in `stories/` go away. The story
 * expires; the photograph does not.
 *
 * Zero dependencies, on purpose. Same rule as the validator.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, renameSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve, extname, basename } from 'node:path';

import { STORY_HOURS, isStamp, nowStamp, storyWindow, storyPhase } from './clock.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DATA = join(ROOT, 'data');
const STORIES = join(ROOT, 'stories');
const PHOTOS = join(ROOT, 'photos');

const STORIES_JSON = join(DATA, 'stories.json');
const RESTAURANTS_JSON = join(DATA, 'restaurants.json');

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const PHOTO_EXT = /\.(webp|jpg|jpeg|png|avif)$/i;

/* Every file in the repo is two-space JSON with a newline on the end, and
   every one of them round-trips through this exactly, so a script rewriting
   one leaves a diff of the lines it actually changed and nothing else. */
function readJSON(path, fallback) {
  if (!existsSync(path)) return fallback;
  return JSON.parse(readFileSync(path, 'utf8'));
}
function writeJSON(path, value) {
  writeFileSync(path, JSON.stringify(value, null, 2) + '\n');
}

function die(message) {
  console.error(`stories: ${message}`);
  process.exit(1);
}

/* ------------------------------------------------------------------ reading */

/* "--at 2026-09-14T21:00" and "--at=2026-09-14T21:00" both, plus bare flags. */
function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith('--')) { out._.push(arg); continue; }
    const eq = arg.indexOf('=');
    const key = eq === -1 ? arg.slice(2) : arg.slice(2, eq);
    if (eq !== -1) { out[key] = arg.slice(eq + 1); continue; }
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) { out[key] = true; continue; }
    out[key] = next;
    i++;
  }
  return out;
}

/* "3 September, 21:00" out of "2026-09-03T21:00", for a log a person reads. */
function human(stamp) {
  return String(stamp || '').replace('T', ' ');
}

/* The countdown, in the same words the viewer uses. */
function left(ms) {
  if (ms <= 0) return 'over';
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `${mins}m left`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h left`;
  return `${Math.floor(hours / 24)}d ${hours % 24}h left`;
}

/* ------------------------------------------------------------------ status */

function status(stories) {
  const now = Date.now();
  if (!stories.length) {
    console.log('Nothing in data/stories.json. No ring, no viewer, nothing on the page.');
    return;
  }

  const buckets = { up: [], queued: [], over: [], draft: [], broken: [] };
  for (const story of stories) buckets[storyPhase(story, now)].push(story);

  const line = (story, note) => {
    const w = storyWindow(story);
    const what = story.video ? `video ${story.video}` : `photo ${story.photo}`;
    const spot = story.spot ? ` -> ${story.spot}` : '';
    console.log(`  ${story.id.padEnd(32)} ${what}${spot}`);
    console.log(`  ${' '.repeat(32)} ${note}${w.explicit ? '' : `  (${STORY_HOURS}h window)`}`);
  };

  const section = (title, list, note) => {
    if (!list.length) return;
    console.log(`\n${title}`);
    for (const story of list) line(story, note(story));
  };

  section('UP NOW', buckets.up, (s) => {
    const w = storyWindow(s);
    return `until ${human(w.until)}, ${left(w.untilMs - now)}`;
  });
  section('QUEUED', buckets.queued, (s) => {
    const w = storyWindow(s);
    return `goes up ${human(w.from)}, comes down ${human(w.until)}`;
  });
  section('OVER — the next tick clears these', buckets.over, (s) => {
    const w = storyWindow(s);
    return `ran out ${human(w.until)}`;
  });
  section('DRAFT — "live" is false, so nothing is shown', buckets.draft, (s) => {
    const w = storyWindow(s);
    return w.until ? `would run to ${human(w.until)}` : 'no time set';
  });
  section('BROKEN — no "from" and no "until", so nothing knows when it ends', buckets.broken,
    () => 'give it a "from"');

  console.log(`\nTallinn says ${human(nowStamp())}.`);
}

/* ---------------------------------------------------------------- schedule */

/* Put a photograph in the queue: the file is already in stories/, this writes
   the entry that says which place it belongs to and when it goes up. The end
   is left out on purpose — that is what the 36 hours are for. */
function schedule(args, stories) {
  const file = typeof args.schedule === 'string' ? basename(args.schedule) : null;
  if (!file) die('--schedule wants a file in stories/, such as --schedule kokomo-brunch.webp');
  if (!PHOTO_EXT.test(file) && !/\.(mp4|webm)$/i.test(file)) {
    die(`"${file}" is neither a picture nor an .mp4 — see stories/README.md`);
  }
  if (!existsSync(join(STORIES, file))) {
    die(`"stories/${file}" is not in the repo. Put the file there first.`);
  }

  const at = args.at;
  if (!isStamp(at)) die('--at wants a Tallinn date and time, such as --at 2026-09-14T09:00');
  if (args.until !== undefined && !isStamp(args.until)) {
    die('--until wants a Tallinn date and time, such as --until 2026-09-15T21:00');
  }

  const id = typeof args.id === 'string' ? args.id : basename(file, extname(file));
  if (!SLUG.test(id)) die(`"${id}" is not a lowercase slug — pass --id with one`);
  if (stories.some((s) => s.id === id)) {
    die(`there is already a story called "${id}" — pass --id with another name`);
  }

  const spot = typeof args.spot === 'string' ? args.spot : null;
  if (spot) {
    if (!SLUG.test(spot)) die(`"${spot}" is not a place id`);
    const places = readJSON(RESTAURANTS_JSON, []);
    if (!places.some((p) => p.id === spot)) {
      die(`"${spot}" is not a place in data/restaurants.json`);
    }
  }

  /* The order the README writes an entry in, so a hand-written one and a
     generated one read the same in a diff. */
  const entry = { id, live: true };
  if (PHOTO_EXT.test(file)) entry.photo = file; else entry.video = file;
  entry.from = at;
  if (args.until) entry.until = args.until;
  if (typeof args.caption === 'string') entry.caption = { en: args.caption };
  if (spot) entry.spot = spot;

  stories.push(entry);
  writeJSON(STORIES_JSON, stories);

  const w = storyWindow(entry);
  console.log(`Queued "${id}".`);
  console.log(`  up      ${human(w.from)}`);
  console.log(`  down    ${human(w.until)}${w.explicit ? '' : `  (${STORY_HOURS} hours later)`}`);
  if (spot) console.log(`  place   ${spot}${entry.photo ? ` — the picture moves into photos/${spot}/ when it is over` : ''}`);
  if (!entry.caption) console.log('  Write a "caption" in data/stories.json before it goes up.');
}

/* -------------------------------------------------------------------- tick
 * What the clock says is due, done. Retiring is the whole of it: a story that
 * has run out is already invisible to every viewer — `assets/app.js` stopped
 * showing it the minute `until` passed — so nothing here is racing anybody.
 * This is the tidying up afterwards, which is the part a person forgets.
 */
function tick(stories, { dry }) {
  const now = Date.now();
  const places = readJSON(RESTAURANTS_JSON, []);
  const notes = [];

  let storiesChanged = false;
  let placesChanged = false;
  const filed = [];
  const retired = [];
  const kept = [];

  for (const story of stories) {
    if (storyPhase(story, now) !== 'over') { kept.push(story); continue; }
    const w = storyWindow(story);

    /* A photograph of a place goes and lives on that place. This is the whole
       point of posting one here rather than somewhere that forgets it. */
    const archive = story.photo && story.spot ? archivePhoto(story, places, dry) : null;

    if (archive && archive.ok) {
      notes.push(`${story.id}: ran out ${human(w.until)} — photo filed as photos/${story.spot}/${archive.name}, entry and file removed`);
      filed.push(`${story.spot}/${archive.name}`);
      placesChanged = true;
      storiesChanged = true;
      continue;                       /* the entry goes with the file */
    }
    if (archive && !archive.ok) notes.push(`${story.id}: ${archive.why}`);

    /* Everything else is switched off and left alone. A video is somebody's
       work and deleting it is somebody's decision, and the validator already
       says, gently, that the file is no longer named by anything. */
    if (story.live === true) {
      notes.push(`${story.id}: ran out ${human(w.until)} — switched off, stories/${story.video || story.photo} is yours to delete`);
      retired.push(story.id);
      if (!dry) story.live = false;
      storiesChanged = true;
    }
    kept.push(story);
  }

  if (storiesChanged && !dry) writeJSON(STORIES_JSON, kept);
  if (placesChanged && !dry) writeJSON(RESTAURANTS_JSON, places);

  /* Said whether anything changed or not: this is the log somebody reads at
     nine in the morning to find out why the ring is or is not there. */
  const now2 = Date.now();
  const up = stories.filter((s) => storyPhase(s, now2) === 'up');
  const queued = stories.filter((s) => storyPhase(s, now2) === 'queued');

  for (const note of notes) console.log(`  ${note}`);
  if (!notes.length) console.log('  nothing was due');

  console.log(`\n  up now   ${up.length ? up.map((s) => s.id).join(', ') : '(none)'}`);
  for (const s of queued) {
    console.log(`  queued   ${s.id} — ${human(storyWindow(s).from)}`);
  }
  console.log(`\n  Tallinn says ${human(nowStamp())}.`);

  /* One line for the commit the workflow writes, in the words somebody
     reading `git log` a month later would want: what moved, and where to. */
  const parts = [];
  if (filed.length) parts.push(`file ${filed.join(', ')}`);
  if (retired.length) parts.push(`take down ${retired.join(', ')}`);
  const summary = parts.length
    ? parts.join(' and ').replace(/^./, (c) => c.toUpperCase())
    : 'Nothing was due';

  return { changed: storiesChanged || placesChanged, summary };
}

/* Move the picture out of stories/ and into the place's own folder, numbered
   the way every other photo there is. Nothing is overwritten: a name that is
   taken is a reason to stop, not to pick a different one quietly. */
function archivePhoto(story, places, dry) {
  const place = places.find((p) => p.id === story.spot);
  if (!place) return { ok: false, why: `"${story.spot}" is no longer a place in restaurants.json — left switched on for you to look at` };

  const src = join(STORIES, story.photo);
  if (!existsSync(src)) return { ok: false, why: `stories/${story.photo} is already gone — nothing to file` };

  const dir = join(PHOTOS, place.id);
  const taken = existsSync(dir) ? readdirSync(dir) : [];
  const numbered = taken
    .map((name) => /^(\d+)\./.exec(name))
    .filter(Boolean)
    .map((m) => Number(m[1]));
  const next = (numbered.length ? Math.max(...numbered) : 0) + 1;
  const name = `${String(next).padStart(2, '0')}${extname(story.photo).toLowerCase()}`;

  if (taken.includes(name)) return { ok: false, why: `photos/${place.id}/${name} already exists — left switched on` };
  if (!Array.isArray(place.photos)) return { ok: false, why: `"${place.id}" has no "photos" array — left switched on` };

  if (!dry) {
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    renameSync(src, join(dir, name));
    place.photos.push(name);
  }
  return { ok: true, name };
}

/* --------------------------------------------------------------------- main */

const args = parseArgs(process.argv.slice(2));

if (args.help || args.h) {
  console.log(`Tallinn Tastebuds — the story queue.

  node tools/stories.mjs
      What is queued, what is up, what is over.

  node tools/stories.mjs --schedule kokomo-brunch.webp --spot kokomo \\
                         --at 2026-09-14T09:00 --caption "Sunday brunch."
      Write the entry for a file already sitting in stories/. It goes up at
      --at and comes down ${STORY_HOURS} hours later, unless --until says otherwise.
      --id names it, if the filename is not the name you want.

  node tools/stories.mjs --tick [--dry-run]
      What the clock says is due: a story that has run out is switched off,
      and a photograph of a place is filed into photos/<spot>/ and listed on
      the place. Run hourly by .github/workflows/stories.yml.
`);
  process.exit(0);
}

const stories = readJSON(STORIES_JSON, []);
if (!Array.isArray(stories)) die('data/stories.json is not an array');

if (args.schedule !== undefined) {
  schedule(args, stories);
} else if (args.tick) {
  const dry = Boolean(args['dry-run'] || args.dry);
  console.log(dry ? 'Tick (dry run — nothing is written):' : 'Tick:');
  const result = tick(stories, { dry });
  /* The workflow commits only when there is something to commit, and says
     what it was in the commit message. */
  if (process.env.GITHUB_OUTPUT) {
    writeFileSync(process.env.GITHUB_OUTPUT,
      `changed=${result.changed && !dry}\nsummary=${result.summary}\n`, { flag: 'a' });
  }
} else {
  status(stories);
}
