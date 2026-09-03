#!/usr/bin/env node
/**
 * Tallinn Tastebuds — the story video pass.
 *
 *     node tools/storymedia.mjs           what each story video is, and what is wrong with it
 *     node tools/storymedia.mjs --fix     convert the ones that are not web-ready, in place
 *
 * `--fix` is what `.github/workflows/story-media.yml` runs on every push that
 * touches `stories/`. It exists because of one asymmetry: `admin.html` can now
 * post a video from a phone, and what a browser hands back depends entirely on
 * which browser it was. Safari writes MP4/H.264, which every engine plays.
 * Chrome and Firefox write WebM, which Safari will not touch. And a browser
 * with no MediaRecorder in it uploads the file exactly as it came off the
 * camera — 4K HEVC, sideways, sixty megabytes.
 *
 * Rather than teach the form to refuse three of those four, it posts whatever
 * it has and this pass makes it ordinary afterwards: one H.264 MP4, inside
 * 1080×1920, `yuv420p`, index at the front, under the budget. The story entry
 * follows the file to its new name, so a story posted from a laptop on Chrome
 * is watchable on an iPhone a minute later without anybody being told.
 *
 * A video that is already all of those things is not touched — which is what
 * makes the workflow safe to run on its own commit: the second pass finds
 * nothing to do. That is the whole loop guard.
 *
 * Zero npm dependencies, same rule as everything else in here. It shells out
 * to ffmpeg and ffprobe, which the runner already has and a laptop doing this
 * by hand already needs.
 */

import { readFileSync, writeFileSync, existsSync, unlinkSync, renameSync,
         statSync, openSync, readSync, closeSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve, extname, basename } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const STORIES = join(ROOT, 'stories');
const STORIES_JSON = join(ROOT, 'data', 'stories.json');

/* The same three numbers stories/README.md states, in the one place that can
   actually enforce them. */
const MAX_W = 1080;
const MAX_H = 1920;
const BUDGET = 8 * 1024 * 1024;
/* What the encoder aims at, which has to be under what is allowed — a target
   equal to the limit lands over it half the time. */
const TARGET = 6 * 1024 * 1024;
const AUDIO_BITS = 128000;
const POSTER_AT = 0.3;

function readJSON(path, fallback) {
  if (!existsSync(path)) return fallback;
  return JSON.parse(readFileSync(path, 'utf8'));
}
function writeJSON(path, value) {
  writeFileSync(path, JSON.stringify(value, null, 2) + '\n');
}

function die(message) {
  console.error(`storymedia: ${message}`);
  process.exit(1);
}

/* Kilobytes under a megabyte, megabytes over it. A story is small enough that
   "0.0 MB" is a real answer otherwise. */
function weigh(bytes) {
  return bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)} MB`
                          : `${Math.round(bytes / 1024)} KB`;
}

/* The order README.md writes a story entry in. An entry this pass has touched
   is rebuilt through it so a poster added here sits next to the video it
   belongs to, rather than at the end where it would read as an afterthought
   and make a worse diff. Unknown keys keep their place at the back, so a field
   added to the data after this was written rides along untouched. */
const STORY_ORDER = ['id', 'live', 'video', 'photo', 'seconds', 'poster',
                     'from', 'until', 'caption', 'spot', 'link', 'linkLabel'];

function reorder(story) {
  const out = {};
  for (const key of STORY_ORDER) if (story[key] !== undefined) out[key] = story[key];
  for (const key of Object.keys(story)) if (out[key] === undefined) out[key] = story[key];
  return out;
}

function run(cmd, args) {
  return execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

function have(cmd) {
  try { run(cmd, ['-version']); return true; } catch (e) { return false; }
}

/* ----------------------------------------------------------------- reading */

/* What ffprobe says about the one video stream and the one audio stream that
   matter. Everything else an iPhone writes — the spatial audio track, the four
   metadata streams — is not asked about, because it is not kept either. */
function probe(path) {
  let raw;
  try {
    raw = run('ffprobe', ['-v', 'error', '-show_format', '-show_streams',
                          '-of', 'json', path]);
  } catch (e) {
    return { unreadable: true };
  }
  const data = JSON.parse(raw);
  const streams = data.streams || [];
  const video = streams.find((s) => s.codec_type === 'video');
  const audio = streams.find((s) => s.codec_type === 'audio');
  if (!video) return { unreadable: true };

  return {
    unreadable: false,
    container: (data.format && data.format.format_name) || '',
    duration: Number((data.format && data.format.duration) || video.duration || 0),
    codec: video.codec_name || '',
    pixels: video.pix_fmt || '',
    width: Number(video.width || 0),
    height: Number(video.height || 0),
    /* An iPhone stores the picture the way the sensor read it and writes the
       turn into a matrix beside it. ffmpeg applies that on its own; it is
       reported here only so a rotated file reads as a reason to convert. */
    rotated: (video.side_data_list || []).some((d) => Number(d.rotation || 0) % 360 !== 0),
    /* HDR, which is the difference between colours that look right and a grey
       wash on an ordinary screen. Only these two transfers need tone mapping. */
    hdr: video.color_transfer === 'smpte2084' || video.color_transfer === 'arib-std-b67',
    audio: Boolean(audio),
    size: statSync(path).size
  };
}

/* Whether the index is at the front of the file, which is the difference
   between a video that starts playing while it downloads and one that plays
   when it has finished. ffprobe will not say, so the atoms are walked here:
   `moov` before `mdat` is the whole test, and it is eight bytes at a time. */
function fastStart(path) {
  const fd = openSync(path, 'r');
  try {
    const head = Buffer.alloc(16);
    let pos = 0;
    for (;;) {
      if (readSync(fd, head, 0, 16, pos) < 8) return false;
      const type = head.toString('latin1', 4, 8);
      if (type === 'moov') return true;
      if (type === 'mdat') return false;
      let size = head.readUInt32BE(0);
      if (size === 1) size = Number(head.readBigUInt64BE(8));   /* 64-bit atom */
      if (size < 8) return false;                               /* 0 means "to EOF" */
      pos += size;
    }
  } finally {
    closeSync(fd);
  }
}

/* Every reason this file is not something to serve, in the words a person
   would use. No reasons means leave it alone. */
function faults(file, info) {
  const out = [];
  if (info.unreadable) return ['ffprobe cannot read it'];
  if (extname(file).toLowerCase() !== '.mp4') out.push(`is a ${extname(file).slice(1).toUpperCase()}`);
  else if (!/mp4|mov/.test(info.container)) out.push(`is not really an MP4 (${info.container})`);
  if (info.codec !== 'h264') out.push(`is ${info.codec.toUpperCase()}, which not every browser plays`);
  if (info.pixels && info.pixels !== 'yuv420p') out.push(`is ${info.pixels}`);
  if (info.hdr) out.push('is HDR, which decodes grey on an ordinary screen');
  if (info.rotated) out.push('is stored sideways with a rotation flag');
  if (info.width > MAX_W || info.height > MAX_H) out.push(`is ${info.width}×${info.height}`);
  if (info.width % 2 || info.height % 2) out.push('has an odd number of pixels on a side');
  if (info.size > BUDGET) out.push(`is ${weigh(info.size)}, over the ${weigh(BUDGET)} a story gets`);
  if (out.length === 0 && !fastStart(file)) out.push('has its index at the back, so it will not start until it has all downloaded');
  return out;
}

/* ------------------------------------------------------------- converting */

/* Fitted inside 1080×1920 and never stretched past its own size, then forced
   even on both sides because H.264 has no other option. */
const SCALE = `scale=w='min(${MAX_W},iw)':h='min(${MAX_H},ih)':` +
              `force_original_aspect_ratio=decrease:flags=lanczos,` +
              `scale=w=trunc(iw/2)*2:h=trunc(ih/2)*2`;

/* The tone map out of stories/README.md, which is the part not to skip:
   without it the HDR colours are decoded flat and the whole thing looks
   washed out and grey. It needs an ffmpeg built with libzimg, so the caller
   falls back to the plain chain if this one will not run. */
const TONEMAP = `zscale=t=linear:npl=100,format=gbrpf32le,zscale=p=bt709,` +
                `tonemap=tonemap=hable:desat=0,zscale=t=bt709:m=bt709:r=tv,format=yuv420p`;

function convert(src, dest, info, { tonemap }) {
  const secs = info.duration > 0 ? info.duration : 15;
  /* One pass at a bitrate the running time can afford. CRF decides the
     quality and maxrate is the ceiling that keeps a busy fifteen seconds from
     going over the budget anyway. */
  const bits = Math.round(Math.max(700000,
    Math.min(5000000, (TARGET * 8) / secs - (info.audio ? AUDIO_BITS : 0))));

  const filters = tonemap ? `${SCALE},${TONEMAP}` : SCALE;
  const args = ['-y', '-i', src, '-map', '0:v:0'];
  if (info.audio) args.push('-map', '0:a:0');
  args.push(
    '-vf', filters,
    '-c:v', 'libx264', '-crf', '23', '-preset', 'slow', '-profile:v', 'high',
    '-pix_fmt', 'yuv420p',
    '-maxrate', String(bits), '-bufsize', String(bits * 2)
  );
  if (info.audio) args.push('-c:a', 'aac', '-b:a', String(AUDIO_BITS), '-ac', '2');
  else args.push('-an');
  args.push('-movflags', '+faststart', dest);

  run('ffmpeg', args);
}

function makePoster(video, dest) {
  run('ffmpeg', ['-y', '-ss', String(POSTER_AT), '-i', video, '-frames:v', '1',
                 '-vf', 'scale=540:-2', '-q:v', '6', dest]);
}

/* --------------------------------------------------------------------- run */

const fix = process.argv.slice(2).some((a) => a === '--fix');

const stories = readJSON(STORIES_JSON, []);
if (!Array.isArray(stories)) die('data/stories.json is not an array');

const withVideo = stories.filter((s) => s && typeof s.video === 'string');

if (!withVideo.length) {
  console.log('No story in data/stories.json has a video. Nothing to look at.');
  if (process.env.GITHUB_OUTPUT) {
    writeFileSync(process.env.GITHUB_OUTPUT, 'changed=false\nsummary=Nothing to convert\n', { flag: 'a' });
  }
  process.exit(0);
}

const tools = have('ffprobe') && have('ffmpeg');
if (!tools) {
  const line = 'ffmpeg and ffprobe are not on this machine, so nothing can be checked.';
  if (fix) die(line);
  console.log(line);
  console.log('Install them (brew install ffmpeg, apt install ffmpeg) and run this again.');
  process.exit(0);
}

const converted = [];
const missingFiles = [];
const touched = new Set();
let changed = false;

/* Every filename any story already names, so a conversion never lands on top
   of somebody else's file. A name that is taken is a reason to pick another
   one, never a reason to overwrite — the same rule tools/stories.mjs files a
   photograph under. */
function namedElsewhere(mine) {
  const names = new Set();
  for (const story of stories) {
    if (story === mine) continue;
    for (const key of ['video', 'photo', 'poster']) {
      if (typeof story[key] === 'string') names.add(story[key]);
    }
  }
  return names;
}

function freeName(base, ext, mine, current) {
  const taken = namedElsewhere(mine);
  const isFree = (name) =>
    name === current || (!taken.has(name) && !existsSync(join(STORIES, name)));
  if (isFree(`${base}.${ext}`)) return `${base}.${ext}`;
  let n = 2;
  while (!isFree(`${base}-${n}.${ext}`)) n++;
  return `${base}-${n}.${ext}`;
}

for (const story of withVideo) {
  const path = join(STORIES, story.video);
  if (!existsSync(path)) {
    missingFiles.push(story.video);
    console.log(`  ${story.id.padEnd(30)} stories/${story.video} is not in the repo`);
    continue;
  }

  const info = probe(path);
  const wrong = faults(path, info);

  if (!wrong.length) {
    console.log(`  ${story.id.padEnd(30)} ${story.video} — ${info.width}×${info.height} H.264, ` +
                `${info.duration.toFixed(1)}s, ${weigh(info.size)}. Ready.`);
    continue;
  }

  console.log(`  ${story.id.padEnd(30)} ${story.video} — ${wrong.join('; ')}`);
  if (!fix) continue;

  /* Same base name, an .mp4 on the end, and a temporary file in between so a
     conversion that dies half way leaves the original where it was rather
     than a truncated file with the right name. */
  const base = basename(story.video, extname(story.video));
  const finalName = freeName(base, 'mp4', story, story.video);
  const temp = join(STORIES, `${base}.converting.mp4`);

  try {
    try {
      convert(path, temp, info, { tonemap: info.hdr });
    } catch (e) {
      if (!info.hdr) throw e;
      /* An ffmpeg without libzimg cannot tone map. A washed-out story is
         still a story; a failed workflow is not. */
      console.log(`  ${' '.repeat(30)} tone mapping would not run — converting without it`);
      convert(path, temp, info, { tonemap: false });
    }

    if (finalName !== story.video) unlinkSync(path);
    renameSync(temp, join(STORIES, finalName));
    story.video = finalName;
    touched.add(story.id);
    changed = true;

    const after = statSync(join(STORIES, finalName));
    console.log(`  ${' '.repeat(30)} -> ${finalName}, ${weigh(after.size)}`);
    converted.push(story.id);
  } catch (e) {
    if (existsSync(temp)) unlinkSync(temp);
    die(`could not convert stories/${story.video} for "${story.id}": ${e.message}`);
  }
}

/* A poster is what stands in the frame while the video is still arriving, and
   a story posted from a browser that could not make one has none. Taken from
   the finished file, so it is the frame the viewer will actually see. */
if (fix) {
  for (const story of withVideo) {
    const video = join(STORIES, story.video);
    if (!existsSync(video)) continue;
    if (story.poster && existsSync(join(STORIES, story.poster))) continue;

    const name = freeName(basename(story.video, extname(story.video)), 'jpg', story, story.poster);
    try {
      makePoster(video, join(STORIES, name));
      story.poster = name;
      touched.add(story.id);
      changed = true;
      console.log(`  ${story.id.padEnd(30)} poster frame -> ${name}`);
    } catch (e) {
      console.log(`  ${story.id.padEnd(30)} no poster frame could be taken (${e.message})`);
    }
  }
}

/* Only the entries this pass changed are rebuilt in key order. Rewriting the
   others would be a diff full of lines nobody edited. */
if (changed) {
  writeJSON(STORIES_JSON, stories.map((s) => (s && touched.has(s.id) ? reorder(s) : s)));
}

if (missingFiles.length) {
  console.log(`\n${missingFiles.length} story file(s) named in data/stories.json are not here. ` +
              'tools/validate.mjs fails on that; this pass leaves it alone.');
}

if (!fix) {
  console.log('\nNothing was changed. Run it with --fix to convert what is listed above.');
}

const summary = converted.length
  ? `Convert ${converted.join(', ')} to web-ready MP4`
  : 'Nothing to convert';

if (process.env.GITHUB_OUTPUT) {
  writeFileSync(process.env.GITHUB_OUTPUT, `changed=${changed}\nsummary=${summary}\n`, { flag: 'a' });
}
