# The mark

The mouth out of `source-artwork.jpg` — the watercolour-and-ink portrait the
identity comes from — cut away from the face along its own ink line. Not a
redrawing of it. The brush marks, the olive teeth, the red in the gap and the
wobble of the pen are the mark.

```
mark.webp          the painted mouth, cut out, 380px wide
                   → the brand card on the map, the three pass pages
icon-32.png        the same mouth on the purple its background was painted
icon-48.png        in, as a disc
                   → the favicon on all four pages
icon-180.png       the same, on a filled square: iOS rounds its own corners
                   and does not honour transparency
                   → the home-screen icon
og.jpg             1200x630 share card — mouth, name, tagline, handle
mark-pin.svg       the same drawing reduced to one ink and traced: the lip as
                   a line, the dark as one band, the teeth punched out of it
                   → the CSS mask on the chosen map pin
mark-mono.svg      the full-detail one-ink trace, every stroke kept
                   → anywhere it has to print in a single colour
source-artwork.jpg the painting
```

Two of these are vector and five are not, and the split is not arbitrary. The
mark is a watercolour, so wherever it can simply be shown, it is shown: a
photograph of the paint. The two SVGs exist for the one thing a photograph
cannot do — take a colour it is told to. `mark-pin.svg` fills with whatever
`currentColor` is, which is how the mouth on the map ends up wearing the pin's
own colour and changing with the swatches. `mark-mono.svg` does the same for
one-ink printing. Both are traced from the same pixels as `mark.webp`.

`mark-pin.svg` is deliberately the coarser of the two: on the map it is 26
pixels across, and at that size thirty separate teeth are one grey smudge.

Colours, all of them lifted off the painting:

    aubergine  #8E5C9C   the ground behind the icon
    lip        #A9707E
    ink        #241A1F
    tooth      #F5F0E2 through #BEB98C
    berry      #B41F2B

Everything here is rebuilt from `source-artwork.jpg` rather than edited by
hand, so a new size or a new share card is a re-render, not a redraw.
