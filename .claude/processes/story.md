# Post a story, schedule one, take one down

A story is the one thing on this map that is not permanent: a video or a
photograph, up for 36 hours and then gone, with its picture moving onto the
place it was shot at. It is an entry in `data/stories.json` and one file in
`stories/`, and the browser does the going up and coming down on its own —
there is nothing to deploy on Saturday morning, because `data/*` is served
`must-revalidate` and a phone opening the map at 09:01 asks the origin.

## Read first

- `README.md` → **Stories**, all of it: the entry field by field, **Post it on
  Saturday**, **The clock**, **And the cron picks it up afterwards**, **Taking
  one down**. Every paragraph in it is a rule.
- `stories/README.md` — what a file should be, the `ffmpeg` line that gets an
  iPhone clip there, and what the poster frame is for.
- `tools/stories.mjs` and `tools/clock.mjs` headers. The clock arithmetic is
  copied into `assets/app.js` because the browser cannot import from `tools/`;
  the two have to match, and `clock.mjs` says which number does.

## Posting one

1. **The file.** 9:16 inside 1080×1920, H.264 in an MP4 with AAC audio, under
   15 seconds and under 8 MB; a photo story is a `.webp` or `.jpg`. Straight
   off an iPhone it is HEVC, 4K, HDR and sideways, and all four have to go —
   tone mapping is the step not to skip, or the colours decode grey. Run
   `node tools/storymedia.mjs` over it: it says what is wrong in plain words
   and changes nothing until `--fix`. It needs `ffmpeg` and `ffprobe`.
2. **The poster frame** is the photograph the place keeps once a video story
   is over, so pick the moment rather than taking the first frame by reflex.
   A photo story with a `spot` *becomes* one of that place's photos, so shoot
   it as a picture worth keeping, not a frame with words across it.
3. **The entry.** `node tools/stories.mjs --schedule <file> --spot <id>
   --at YYYY-MM-DDTHH:MM --caption "…"` writes it, for a photo or a video —
   or write it by hand in the same shape. `from` in Tallinn wall clock; leave
   `until` out and it is 36 hours later, which is the answer. `spot` *or*
   `link`, never both. Then open the file: write the caption in the other nine
   languages, since the tool writes one, and for a video name the `poster`,
   which the tool does not.
4. **Burn the words in, or write them in `caption`.** A story opens muted,
   every time.
5. `node tools/stories.mjs` — the queue as it stands. The new entry should be
   in QUEUED or UP NOW, with the window it will stand for.
6. `node tools/validate.mjs`. A story with neither `from` nor `until`, a file
   not in `stories/`, both a `video` and a `photo`, or a `spot` that is not a
   place is an error. An `until` past two days is a warning, and usually
   right.
7. **Watch it** on a local server with the story live: the ring on the mark,
   the viewer, the countdown, the button to the place. A `?story=<id>` link
   opens straight into it.

## Taking one down

Nothing needs taking down. The clock stops showing it and
`.github/workflows/stories.yml` runs `node tools/stories.mjs --tick` on the
hour: a photograph with a `spot` moves into `photos/<spot>/` and onto the
place, entry and all; a video with a `spot` sends its poster frame the same
way and is switched to `live: false` and left in `stories/` for a person to
decide about. `--tick --dry-run` says what it would do.

To pull one early, set `live` to `false` or remove the entry. Once a video has
been gone a while, delete its entry and its file together; the validator
mentions a file no entry names until you do.

If stories stop clearing themselves, the first thing to check is the Actions
tab: GitHub stops scheduled workflows in a repository with no activity for 60
days, and one push starts them again.

## The commit

The tool's own subject is the shape to follow:

> Queue a story for Põhja Konn, up 2026-09-06 20:39
> Take down laboratooriumi-23-2026-09-03

The admin page writes a story as three commits — the video, the poster, the
entry. By hand, one commit carrying the file and the entry is fine; what
matters is that no commit has an entry pointing at a file that is not there
yet.

## Where it goes wrong

- A `.mov` or a `.webm` committed as-is. Safari will not play the one and
  nothing but Safari plays the other; `storymedia.mjs --fix` is the answer.
- A time written in the laptop's clock rather than Tallinn's. Every time in
  the data is Tallinn wall clock, and summer time is worked out for you.
- A caption in English only, on a site with ten languages.
- The cron silently stopped after two quiet months.
