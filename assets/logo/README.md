# The mark

The mouth, cropped out of `source-artwork.jpg` — the photograph of the
watercolour-and-ink portrait the identity comes from, rotated upright. That is
the whole operation. Crop, resize, encode. Nothing is masked out, nothing is
smoothed, nothing is traced, and there is no drawing of the mouth anywhere in
this folder. The wobble of the pen, the olive teeth, the red in the gap and the
paper the paint sank into are the mark.

```
mark.webp          the wide crop — mouth, the nose above it, the jaw below
                   → the three pass pages, og.jpg
mark-round.webp    the square crop, shown round by the stylesheet
                   → the chosen pin on the map, the mark on the brand
icon-32.png        the square crop, at the sizes a browser asks for
icon-48.png        → the favicon on all four pages
icon-180.png       → the home-screen icon; iOS rounds its own corners
og.jpg             1200x630 share card — mouth, name, tagline, handle
source-artwork.jpg the photograph everything above is cut from
```

Two crops, six files. The wide one keeps the mouth in its setting, which is
how it reads at any size a page shows it. The square one is for the frames
that are square or round, where the wide crop would have to be padded or
cut again by the browser.

    wide     (1365, 1275) to (2268, 1975)      903 x 700
    square   (1480, 1370) to (2140, 2030)      660 x 660

Those boxes are in the pixels of the photograph as it came off the camera.
`source-artwork.jpg` in this folder is that photograph resized to 1050 x 1400,
so the same two boxes land here at

    wide     (474, 443) to (788, 686)          314 x 243
    square   (513, 475) to (743, 705)          230 x 230

and 230 square is all the detail there is left to cut from. Every file above
is a resize of one of those, so a new size is a re-render and never a redraw —
and whatever gets rendered is the painting, not an interpretation of it.

The site frames pictures at `border-radius: 2px` and no border, and the wide
crop is framed that way wherever it appears: it is a picture, and it is
allowed to look like one.

The brand is the exception, and it is not really one. The mark at the top left
of the map is the account's face in the position and at the size a profile
picture occupies on a phone, so it is round there and takes the square crop —
which is why `mark-round.webp` is 224px rather than the 112 the pins alone
needed. The pins scale it down and cost nothing extra; the brand would have
been rendering an upscale.
