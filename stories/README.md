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
itself, the expiry, and the link a story carries.

## What a file should be

A story is watched full screen on a phone held upright, so it wants to be tall
and it wants to be small:

- **9:16, 1080×1920.** Anything else is letterboxed rather than cropped — the
  viewer never cuts a picture it was not given.
- **Video: H.264 (`.mp4`), AAC audio.** The one pair every browser plays. VP9
  in a `.webm` is smaller and Safari will not touch it. HEVC is what an iPhone
  records and what only Safari plays — always convert.
- **Photo: `.webp` or `.jpg`,** the same as the photos on the places. A
  photo story stands for six seconds unless the entry says otherwise.
- **Under 15 seconds and under 8 MB.** Cloudflare Pages refuses a file over
  25 MB outright, and a phone on a tram gives up long before that.
- **Burn the words in, or write them in `caption`.** There are no subtitles
  here, and a story always opens muted.

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

A story that has run out stops being shown the moment its `until` passes, but
the file stays in the repo until it is deleted. Once a story is off the map,
delete its entry and its file together — nothing links to either, and the repo
does not need to carry every video ever posted.
