# The blog's clips

The looping pictures on the posts at [/blog](../README.md#the-blog), and the
scenes they are drawn from. Four files per post, all named after the post's
`id` in `data/blog.json`:

```
clips/a-save-is-free-and-the-number-is-other-people.png              the clip
clips/a-save-is-free-and-the-number-is-other-people-still.png        its first frame
clips/a-save-is-free-and-the-number-is-other-people-green.png        the same, in the dark style
clips/a-save-is-free-and-the-number-is-other-people-green-still.png
clips/scenes/a-save-is-free-and-the-number-is-other-people.html      what all four are drawn from
```

Nothing here is edited by hand. `node tools/blogclips.mjs` draws every file
above out of the scene beside it; `--only <post-id>` draws one, and `--check`
says which are missing. It needs a Chromium — `CHROME=/path/to/chrome` if it
cannot find one — and nothing else.

## What a clip is

**An animated PNG**, which is the thing people mean when they say a GIF and is
better at being one: truecolour rather than 256, no dithering across a page
that is mostly flat fill, and every browser since 2017 plays it out of a plain
`<img>` — no autoplay policy to satisfy, no poster, no controls to hide.

- **480×270, drawn at two device pixels**, so it is still sharp on the phone
  most of the reading happens on.
- **Twelve frames a second**, and a beat that holds is one frame with a long
  delay rather than twelve identical ones.
- **Around four seconds and near 200 KB.** The validator warns past 600 KB,
  which is the size a scene reaches when something enormous moves on every
  frame.
- **Looping for ever, with no way to stop it.** That is the one cost of the
  format, and the answer is the still: `assets/blog.js` draws a `<picture>`
  that serves `-still.png` to anybody whose machine asks for less motion.

## What a scene is

Not a recording of the site. A scene is the site's own stylesheets, tokens and
class names — `.card`, `.place-name`, `.chip`, `.menu-row`, `.rail-btn`, the
price gauge, the real pins — arranged into the one interaction the post is
about. `clips/scenes/scene.css` is the stage and the pointer; `scene.js` is the
whole of the machinery.

**A scene is a pure function of time.** Nothing animates itself, no transition
runs and no timer fires: `at(t)` puts everything where it is at millisecond
`t`, and that is what lets the tool ask for frame 31 and get frame 31 on any
machine in any year. A CSS animation left running inside a scene is the one
thing that breaks it.

```html
<meta name="clip" content="ms=4000; w=480; h=270">
<script src="scene.js"></script>
<script>
Clip.scene({
  build: function (stage, clip) { /* put the site's components on the stage */ },
  at: function (t, held) { /* and place them for this millisecond */ }
});
</script>
```

`Clip.at(t, from, to)` is an eased 0-to-1 across a window and is what every
movement in every scene is built out of; `Clip.lerp` is the same between two
numbers, `Clip.cursor(stage)` is the map's own tour pointer with a press, and
`Clip.ground(stage, w, h)` is the few streets a map scene stands on.

Open a scene in a browser with no query string and it plays on a loop in real
time, which is how you write one. `?t=1500` freezes it at a millisecond, and
`?style=green` draws it in the dark.

## Two things that will bite

- **No composited layer that has to stand still.** `opacity` on a layer, a
  `filter`, a `backdrop-filter` — Chromium samples those against the page, and
  two frames that look identical come back different by a bit or two. The tool
  compares frames exactly, so a scene doing that in its still beats collapses
  nothing and the clip comes out ten times heavier. Move things with
  `transform` and change them by class.
- **A fade costs its area times its length.** Every frame of one is a
  rectangle of changed pixels, and a card the width of the stage fading over
  three quarters of a second is fifteen of those — half a megabyte to say
  something a quarter of a second says as well. Keep a fade short, fade
  something small, or reveal it in one step. The same arithmetic is why the
  story clip's ring stands still: a conic gradient is a few thousand colours,
  and PNG is not built for those.
- **A full Chrome may not give you the window you asked for.** `--window-size`
  is a request, and a headless environment can clamp the viewport's height to
  something taller than the stage is — one machine here rendered every 270-point
  stage 183 points tall, which is not an error and is not reported: the shot
  comes back the right size with the bottom of the scene simply missing, the
  frames that would have differed down there collapse into holds, and the clip
  lands lighter than it should be with nothing to say it went wrong. Playwright's
  `headless_shell` honours the size, so `CHROME=/opt/pw-browsers/chromium_headless_shell-*/chrome-linux/headless_shell`
  is the way out of it. The tell is a scene you can see whole in a browser and
  cannot see whole in its clip; redraw one of the clips already in the repo and
  compare, since those were drawn on a browser that behaved.
- **The stage is 480 points wide, which is a phone.** Everything on this site
  below 860px is in its phone layout — the rail collapses its pills to discs,
  the language switch folds. `hint-open` is the class the rail itself uses to
  open a pill, and it is what a scene should use when the label is the point.
