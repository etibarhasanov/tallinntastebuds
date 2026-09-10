---
name: story
description: Post a story, schedule one for a day and time, or take one down. Use for anything in data/stories.json or stories/, by hand, with tools/stories.mjs, or through /admin.html.
---

# Post a story, schedule one, take one down

A story is the one thing on this map that is not permanent: a video or a
photograph, up for 36 hours and then gone, with its picture moving onto the
place it was shot at. It is one entry in `data/stories.json` and one file in
`stories/`, and the browser does the going up and the coming down on its own:
`assets/app.js` reads the same `from` and `until` out of the file, re-evaluates
every minute, and `data/*` is served `must-revalidate`, so a phone opening the
map at 09:01 asks the origin and gets a story that was sitting there all week.
Nothing is deployed on Saturday morning.

There are two roads in, and they differ in where the commit lands. The admin
page commits **straight to the default branch**, the live site, because a
story that waits for a review has missed the morning it was about. By hand,
the entry goes through a branch and a PR like everything else.

## Read first

- `README.md` → **Stories**, and **The admin page** → **Posting a story** and
  **What it does to a video**.
- `stories/README.md` — what a file should be and the `ffmpeg` lines.
- The headers of `tools/stories.mjs`, `tools/storymedia.mjs` and
  `tools/clock.mjs`.

## The entry

`tools/validate.mjs` (the `stories.json` block, `STORY_KEYS` and the
`stories.forEach` under it) allows exactly these keys — `id, live, video,
photo, seconds, poster, from, until, caption, spot, link, linkLabel` — and
holds them to this:

| Field | Rule | If wrong |
|---|---|---|
| `id` | lowercase slug, unique. A browser remembers watched stories by id, so two sharing one would mark each other seen | error |
| `live` | boolean. `false` parks a draft that nothing shows | error |
| `video` / `photo` | **exactly one**. Video name `^[A-Za-z0-9._-]+\.(mp4\|webm\|mov\|m4v)$`, photo `\.(webp\|jpg\|jpeg\|png\|avif)$`, a bare filename, and the file must be in `stories/` | error |
| a video | over 25 MB, which Cloudflare Pages will not serve | error |
| a video | over 8 MB; a `.webm`; a `.mov` or `.m4v` | warning |
| `seconds` | a photo's stand time, 2 to 20; on a video it does nothing | error / warning |
| `poster` | image filename, must exist; on a photo story it does nothing | error / warning |
| `from`, `until` | `YYYY-MM-DDTHH:MM`, Tallinn wall clock, no offset. At least one of them; `from` before `until` | error |
| an explicit `until` | more than 48 hours after `from` | warning |
| `caption`, `linkLabel` | objects keyed by language code; only codes `ui.json` knows; no empty strings | error |
| `spot` / `link` | never both. `spot` must be a place; `link` must be `https?://…` | error |
| a live story | already over, or with no `caption.en` | warning |
| `stories/` | a file no entry names, or a subfolder | warning |

Nothing weighs a photo or a poster. Leave `until` out and the window is
`from` + 36 hours, which is `STORY_HOURS` in `tools/clock.mjs` **and** a
second copy in `assets/app.js` (`grep -n STORY_HOURS assets/app.js`),
because the browser cannot import from `tools/`; change one, change the
other.

## The admin road

`/admin.html`, unlocked with the device's passphrase, on a device that was set
up once with a fine-grained token (**Contents** and **Pull requests**, read and
write, 90 days). It targets whatever GitHub reports as the repo's default
branch, and it needs nothing from a laptop.

1. **Pick a photograph or a video.** A photo is shrunk on the device down the
   ladder 1600/0.72, 1400/0.68, 1200/0.62, 1100/0.58 until it is under 200 KB,
   as WebP where the browser can really write one and JPEG where it cannot,
   EXIF gone with the re-encode. A video is played through once and drawn onto
   a canvas fitted inside 1080×1920, trimmed to the first 15 seconds, recorded
   at a bitrate worked out from its length (700 kbps to 5 Mbps, aiming under
   6 MB) with the sound routed through Web Audio so nothing comes out of the
   speaker, and a poster frame taken 0.3 s in at 540 px. Press **Squeeze it**,
   and wait as long as the clip lasts. A browser with no `MediaRecorder`
   offers **Upload it as it is** instead, up to 25 MB.
2. **Pick the place** from the list of open places — or **Nowhere in
   particular**, the choice above the names, for a story that is not about a
   place on this map — and **when it goes up**, pre-filled with the current
   Tallinn time; the hint under it prints Tallinn now and the come-down time.
   The hint under the list says what the choice costs: no place means no
   button under the story and no picture left behind. Only the English caption
   is asked for. An empty list is not a choice: the button waits for one of
   the two, so nothing goes up placeless by being scrolled past.
3. **Post it.** The page writes, in this order, so no commit ever names a
   file that is not there: the media file to `stories/<place-or-story>-<date>.<ext>`
   ("Add the photograph|video for the <Place> story"), the poster if there is
   one ("Add the poster frame for the <Place> story"), then the entry
   appended to `data/stories.json` ("Queue a story for <Place>, up <date
   time>") — `live: true`, `from`, `spot`, `caption.en`, and no `until`. The
   id is the place and the day, `-2` for a second one that day. With no place
   the id is `story-<date>`, the three subjects name the date where they named
   the place ("Add the photograph for the 2026-09-14 story", "Queue a story, up
   …"), and the entry has no `spot` — nothing else about the road changes.
4. **What happens next without you.** The push starts the validate and
   Cloudflare deploys, and `.github/workflows/story-media.yml`, which runs
   `node tools/storymedia.mjs --fix` on every push touching `stories/`: a
   video that is not already H.264 in an MP4, `yuv420p`, inside 1080×1920,
   even-sided, not HDR, not rotated by metadata, under 8 MB and with its
   `moov` atom at the front is re-encoded in place (Chrome and Firefox write
   WebM; some browsers write VP9 inside an MP4), renamed if the extension
   changed, given a poster if it had none, committed as "Convert <id> to
   web-ready MP4" and deployed again. Then the hourly tick below files it
   away when the 36 hours are over.
5. **What is left for a laptop:** the caption in the other nine languages,
   which can be added while the story is up without it coming down.

## The hand road

1. **The file.** Video: 9:16 inside 1080×1920, H.264 in an MP4 with AAC,
   under 15 seconds and under 8 MB, index at the front. Straight off an iPhone
   it is HEVC, 4K, HDR and rotated by a display matrix, and `stories/README.md`
   has the one `ffmpeg` line; tone mapping is the step not to skip, or the
   colours decode grey. Or drop any file in `stories/` and let
   `node tools/storymedia.mjs` say what is wrong with it, then `--fix`
   convert it (needs `ffmpeg` and `ffprobe`). Photo: `.webp` or `.jpg`.
2. **The poster** is the photograph the place keeps once a video story is
   over, so pick the frame; `storymedia.mjs --fix` takes one 0.3 s in if you
   do not. A photo story with a `spot` *becomes* one of that place's photos,
   so shoot it as a picture worth keeping.
3. **The entry.** With the file already in `stories/`:

   ```
   node tools/stories.mjs --schedule <file> [--spot <place-id>] --at YYYY-MM-DDTHH:MM \
        [--until YYYY-MM-DDTHH:MM] [--id <slug>] [--caption "…"]
   ```

   It takes a picture or an `.mp4`/`.webm` (not `.mov`), refuses a file that
   is not in `stories/`, a `--spot` that is not a place, and an id that is
   taken; the id defaults to the filename. `--spot` is optional, and left off
   writes a story about nowhere in particular — no button under it, and the
   picture stays in `stories/` when it is over. It writes `live: true`, `from`,
   and `caption.en` only, and prints when the story goes up and comes down.
   It does not write a `poster`: add one by hand for a video. Or write the
   entry yourself in the same shape.
4. **Open `data/stories.json`** and write the caption in the other nine
   languages, and the `poster`.
5. `node tools/stories.mjs` with no flags prints UP NOW, QUEUED, OVER, DRAFT
   and BROKEN, each entry with its window and `(36h window)` where `until`
   was left out, and ends with what Tallinn's clock says. The new entry
   should be in QUEUED or UP NOW.
6. `node tools/validate.mjs`.
7. **Watch it** on a local server with `from` in the past: the turning ring
   on the mark, the viewer, the countdown, the button to the place.
   `?story=<id>` opens straight into it and takes itself off the address bar.
8. Commit, push, PR. The push is the deploy; the story appears when `from`
   comes round with nothing further done.

## Taking one down

Nothing needs taking down. `.github/workflows/stories.yml` runs
`node tools/stories.mjs --tick` at five past every hour, and for every live
story whose window has ended:

- a **photo with a `spot`** is renamed into `photos/<spot>/NN.<ext>`, numbered
  past the highest already there, listed on the place in
  `data/restaurants.json`, and its entry is **removed**;
- a **video with a `spot`** sends its poster the same way, drops the `poster`
  key, and is switched to `live: false` — the video stays in `stories/`,
  because deleting somebody's film is a person's decision;
- **anything else** is switched to `live: false` and left alone;
- a picture that **cannot be filed** — the place is gone, or has no `photos`
  array, or the name is taken — leaves the story live and in OVER with a
  note, and is tried again next hour. Nothing is ever overwritten.

It commits as `github-actions[bot]` with the subject the tool prints ("File
kalve-kadriorg/02.jpg", "Take down laboratooriumi-23-2026-09-03") and pushes.
The push is the deploy — Cloudflare's Git connection sees it like any other;
what a push made with the built-in token does not start is another Actions
workflow, so `validate.yml` does not run on a tick's commit, which is why the
tick runs the validator itself before it pushes. `node tools/stories.mjs
--tick --dry-run` shows what the next tick would do.

To pull one early, set `live` to `false` or remove the entry; either is
immediate for everybody. Once a switched-off video has been gone a while,
delete its entry and its file together — the validator mentions the file
until you do. A `live: false` entry is a DRAFT and the tick never looks at it
again, so a poster still named on one is yours to move or delete.

If stories stop clearing themselves, the first thing to check is the Actions
tab: GitHub stops scheduled workflows in a repository with no activity for 60
days, and one push starts them again.

## The commit

The tools' own subjects are the shape:

> Queue a story for Põhja Konn, up 2026-09-06 20:39
> Add the video for the Põhja Konn story
> Take down laboratooriumi-23-2026-09-03

Two or three commits from the admin page; by hand, one commit carrying the
file and the entry is fine. What matters is that no commit has an entry
pointing at a file that is not there yet.

## The pull request

From the admin page there is none: the commits land on the default branch
and the deploy follows each one. By hand:

1. `git fetch origin claude/tallinn-tastebuds-map-nzoqx0 && git rebase origin/claude/tallinn-tastebuds-map-nzoqx0`
2. `node tools/storymedia.mjs` says the video is web-ready, or `--fix` makes
   it so; `node tools/stories.mjs` shows the entry queued;
   `node tools/validate.mjs`.
3. The story watched on a local server with `from` in the past.
4. One commit with the file and the entry, subject in the tool's shape:
   "Queue a story for <Place>, up <date time>".
5. `git push -u origin <branch>`, or `--force-with-lease` after a rebase.
6. Open the PR against the default branch. The body says what the story is,
   when it goes up and comes down, and which caption languages are in.
7. CI green, then **Rebase and merge**, and delete the branch. Nothing else:
   the browser starts the story when `from` comes round, and the hourly tick
   files it away after. If `story-media.yml` converts the video on the push,
   its commit lands on your branch; rebase it in rather than fighting it.

Taking one down early is the same PR with `live: false`, or from the admin
device a direct edit of `data/stories.json` on the default branch.

## Where it goes wrong

- A `.mov` or a `.webm` committed as-is: `storymedia.mjs --fix`, or the
  workflow, converts it, but the story is unwatchable on an iPhone until
  then. An iPhone recording HEVC on a non-Apple browser is the usual cause;
  Camera → Formats → Most Compatible avoids it.
- A time written in the laptop's clock rather than Tallinn's. Every stamp is
  Tallinn wall clock; summer time is worked out for you, and the admin page
  prints Tallinn's clock under the field for exactly this.
- A caption in English only, on a site with ten languages. The validator
  only warns about a missing `en`, so nothing catches the other nine.
- A replaced file under the same name: `/stories/*` is cached for a week, so
  anyone who saw the old one keeps seeing it. New content is a new name.
- The cron silently stopped after two quiet months.
