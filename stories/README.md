# Stories

The videos behind the ring on the mark. One file per story, named after the
story's `id` in `data/stories.json`:

```
stories/kokomo-brunch.mp4     the video
stories/kokomo-brunch.jpg     optional — the frame shown while it loads
```

`data/stories.json` names the file, never a path: the folder is always this
one. See **[Stories](../README.md#stories)** in the main README for the entry
itself, the expiry, and the link a story carries.

## Exporting one

A story is watched full screen on a phone held upright, so it wants to be tall
and it wants to be small:

- **9:16, 1080×1920.** Anything else is letterboxed rather than cropped — the
  viewer never cuts a picture it was not given.
- **H.264 (`.mp4`), AAC audio.** The one pair every browser plays. VP9 in a
  `.webm` is smaller and Safari will not touch it.
- **Under 15 seconds and under 8 MB.** Cloudflare Pages refuses a file over
  25 MB outright, and a phone on a tram gives up long before that.
- **Burn the words in, or write them in `caption`.** There are no subtitles
  here, and the first play is muted more often than not.

What comes off Instagram or a phone is usually already H.264 and already
vertical. If it needs squeezing, `ffmpeg` does it in one line:

```bash
ffmpeg -i in.mov -vf "scale=1080:1920:force_original_aspect_ratio=decrease" \
       -c:v libx264 -crf 26 -preset slow -c:a aac -b:a 128k -movflags +faststart \
       stories/kokomo-brunch.mp4
```

`-movflags +faststart` is the one flag that matters for the web: it puts the
index at the front of the file so the video starts playing before it has
finished downloading.

A still for the poster, taken two seconds in:

```bash
ffmpeg -i stories/kokomo-brunch.mp4 -ss 2 -frames:v 1 stories/kokomo-brunch.jpg
```

## Take them out again

A story that has run out stops being shown the moment its `until` passes, but
the file stays in the repo until it is deleted. Once a story is off the map,
delete its entry and its video together — nothing links to either, and the
repo does not need to carry every video ever posted.
