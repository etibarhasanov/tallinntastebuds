# The mark

The mouth, cropped out of `source-artwork.jpg` — the photograph of the
watercolour-and-ink portrait the identity comes from, rotated upright. That is
the whole operation. Crop, resize, encode. Nothing is masked out, nothing is
smoothed, nothing is traced, and there is no drawing of the mouth anywhere in
this folder. The wobble of the pen, the olive teeth, the red in the gap and the
paper the paint sank into are the mark.

```
mark.webp          the wide crop — mouth, the nose above it, the jaw below
                   → the brand card on the map, the three pass pages, og.jpg
mark-round.webp    the square crop, shown round by the stylesheet
                   → the chosen pin on the map
icon-48.png        the square crop, at the sizes a browser and Google ask for
icon-96.png        → the favicon on all four pages
icon-192.png
icon-180.png       → the home-screen icon; iOS rounds its own corners
og.jpg             1200x630 share card — mouth, name, tagline, handle
source-artwork.jpg the photograph everything above is cut from
```

`/favicon.ico` at the root of the repo is the square crop too — one file
holding 16, 32 and 48px copies, uncompressed, the boring kind of ICO that
every reader takes.

Two crops, eight files. The wide one keeps the mouth in its setting, which is
how it reads at any size a page shows it. The square one is for the frames
that are square or round, where the wide crop would have to be padded or
cut again by the browser.

    wide     (1365, 1275) to (2268, 1975)      903 x 700
    square   (1480, 1370) to (2140, 2030)      660 x 660

Those boxes are in the pixels of the 3024px-wide photograph off the camera.
`source-artwork.jpg` in this folder is that photograph at 1050px, so a
re-render from the file that is actually here scales them by 1050/3024:

    wide     (474, 443) to (788, 686)          314 x 243
    square   (514, 476) to (743, 705)          229 x 229

229px is the ceiling for anything square, which is why the largest icon is
192 and not 256: every file here is a downscale of one of those two boxes,
never an enlargement and never a redraw — so what gets rendered is the
painting, not an interpretation of it.

The site frames pictures at `border-radius: 2px` and no border, so the mark is
framed the same way. It is a picture, and it is allowed to look like one.


## Why these sizes and not others

Google will only show a site's favicon beside a search result if it is square
with a side that is a multiple of 48 — 48, 96, 144, 192. It ignores anything
else and draws the grey globe instead, which is what tallinntastebuds.ee was
getting: the first icon the pages declared was 32x32, and that is the one it
went to. So 32 is gone and the list starts at 48.

`/favicon.ico` is belt and braces. When Google cannot make sense of a page's
link tags it asks the site root for `/favicon.ico` and nothing else, so the
mouth lives there as well, at a path that never changes.

Google re-crawls favicons on its own schedule and there is no way to ask it to
hurry, so the globe stays for a while after a deploy that fixes this. The
files are what can be got right from here.
