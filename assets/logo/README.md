# The mark

The grin, lifted out of `source-artwork.jpg` — the watercolour-and-ink
portrait the site's identity comes from, rotated upright and scaled down from
the original photograph. Of everything in that painting the mouth was the one
shape that is literally about tasting something, so that is what the mark is.

```
mark.svg          the grin on its own, transparent ground, 94x63 box
                  → the brand card on the map, the three pass pages, og.png
icon.svg          the same grin on the aubergine disc, square
                  → the favicon on all four pages
icon-32.png       the same disc, flattened, for Safari, which does not
                  read SVG favicons
icon-180.png      the grin on a filled aubergine square, for a home screen;
                  iOS rounds the corners and does not honour transparency,
                  so this one is not a disc
og.png            1200x630 share card — mark, name, tagline, handle
mark-mono.svg     one ink, teeth knocked out of the shape as holes rather
                  than painted over, so it works on any ground
source-artwork.jpg the painting
```

`mark-mono.svg` fills with `currentColor`, which only inherits when the file
is inlined into a page. Loaded through an `<img>` it draws black, because an
`<img>` renders the SVG as its own document.

The chosen map pin wears the same one-ink cut, but it is not this file: it is
inlined in `assets/app.js` as `PIN_GRIN`, because it has to take its colour
from the pin it is sitting on and a file behind an `<img>` cannot be told. The
two are the same paths. Change one and change the other.

Colours, all of them lifted off the painting:

    aubergine  #8E5C9C   the disc
    lip        #A9707E   the mouth
    ink        #241A1F   every line
    tooth      #F5F0E2
    berry      #B41F2B   the tongue

Anything regenerated from these — a new PNG size, a new share card — should
be rendered from `mark.svg`, not redrawn.
