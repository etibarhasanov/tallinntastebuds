# Stories

The videos and photographs behind the ring on the mark. One file per story,
named after the story's `id` in `data/stories.json`:

```
stories/pulla-bakery-cinnamon-bun.mp4     the video
stories/pulla-bakery-cinnamon-bun.jpg     optional — the frame shown while it loads
stories/pulla-bakery-window.webp          or a photo story, which is just the picture
```

`data/stories.json` names the file, never a path: the folder is always this
one. See **[Stories](../README.md#stories)** in the main README for the entry
itself, the 36 hours it stands for, and the link a story carries.

## What a file should be

A story is watched full screen on a phone held upright, so it wants to be tall
and it wants to be small:

- **9:16, 1080×1920.** Anything else is letterboxed rather than cropped — the
  viewer never cuts a picture it was not given.
- **Video: H.264 (`.mp4`), AAC audio.** The one pair every browser plays. VP9
  in a `.webm` is smaller and Safari will not touch it. HEVC is what an iPhone
  records and what only Safari plays — always convert. If something else lands
  here anyway, `tools/storymedia.mjs` converts it; see below.
- **Photo: `.webp` or `.jpg`,** the same as the photos on the places. A
  photo story stands for six seconds unless the entry says otherwise — and if
  the entry carries a `spot`, that file is going to *become* one of that
  place's photos once the story is over, so shoot it as a picture worth
  keeping rather than a frame with words across it. It arrives in the
  lightbox upright, which is fine: the lightbox has always taken a photo the
  shape it was given.
- **Under 15 seconds and under 8 MB.** Cloudflare Pages refuses a file over
  25 MB outright, and a phone on a tram gives up long before that.
- **Burn the words in, or write them in `caption`.** There are no subtitles
  here, and a story always opens muted.

## The short way: post it from the phone

`/admin.html` takes a video now, and does all of the above on the device before
it uploads anything: fitted inside 1080×1920, trimmed to the first fifteen
seconds, re-encoded at a bitrate worked out from how long it runs, with a
poster frame taken a third of a second in. It plays the clip through once to do
it — that is what re-encoding means in a browser — so it takes as long as the
clip lasts, and nothing comes out of the speaker while it does.

What container comes back is not up to the page: Safari writes MP4/H.264,
Chrome and Firefox write WebM, and a browser with no `MediaRecorder` in it
uploads the file exactly as it came off the camera. So the form posts whatever
it has and `.github/workflows/story-media.yml` converts anything that is not
already web-ready the moment it lands, moving the story entry onto the new
filename. Nothing to do; it is why a file can change name a minute after it
goes up.

That same pass is worth running by hand over a file you made yourself:

```bash
node tools/storymedia.mjs         # what each story video is, and what is wrong with it
node tools/storymedia.mjs --fix   # convert the ones that are not web-ready, in place
```

It needs `ffmpeg` and `ffprobe` on the machine, changes nothing until `--fix`,
and leaves a file that is already H.264, inside 1080×1920, `yuv420p`, faststart
and under 8 MB exactly where it is.

## Straight off an iPhone

What comes out of the camera roll is HEVC, 4K, HDR and sideways — a display
matrix rotates it rather than the pixels being stored upright. All four have to
go, and one `ffmpeg` line does the lot. Tone mapping is the part not to skip:
without it the HDR colours are decoded flat and the whole thing looks washed
out and grey on an ordinary screen.

```bash
ffmpeg -i IMG_7176.mov -map 0:v:0 -map 0:a:0 \
  -vf "scale=1080:1920:flags=lanczos,zscale=t=linear:npl=100,format=gbrpf32le,\
zscale=p=bt709,tonemap=tonemap=hable:desat=0,zscale=t=bt709:m=bt709:r=tv,format=yuv420p" \
  -c:v libx264 -crf 23 -preset slow -profile:v high \
  -c:a aac -b:a 128k -ac 2 -movflags +faststart \
  stories/pulla-bakery-cinnamon-bun.mp4
```

`-map 0:v:0 -map 0:a:0` takes the picture and the ordinary stereo track and
leaves behind the spatial-audio track and the four metadata streams an iPhone
also writes, none of which a browser has any use for. `-movflags +faststart` is
the one flag that matters for the web: it puts the index at the front of the
file so the video starts playing before it has finished downloading. Rotation
needs no flag — `ffmpeg` reads the display matrix and applies it.

Footage that is already H.264 and already upright needs none of the middle:

```bash
ffmpeg -i in.mp4 -vf "scale=1080:1920:force_original_aspect_ratio=decrease" \
       -c:v libx264 -crf 26 -preset slow -c:a aac -b:a 128k -movflags +faststart \
       stories/kokomo-brunch.mp4
```

A still for the poster, taken a moment in:

```bash
ffmpeg -i stories/kokomo-brunch.mp4 -ss 0.3 -frames:v 1 -vf "scale=540:-2" -q:v 6 \
       stories/kokomo-brunch.jpg
```

## Take them out again

A story stops being shown the moment its time is up — 36 hours after it went
up, unless the entry wrote its own `until`. What happens to the file afterwards
depends on what it is, and `node tools/stories.mjs --tick` does it on the hour
without being asked:

- **A photograph with a `spot`** is moved into `photos/<that place>/`, numbered
  after the photos already there, and listed on the place. It leaves this
  folder entirely. The story was the moment; the picture stays.
- **A video, or a photograph of nothing in particular,** is switched to
  `live: false` and left here. Deleting it is your decision — do it once it has
  been gone a while, entry and file together, and the validator will mention
  the file until you do.
