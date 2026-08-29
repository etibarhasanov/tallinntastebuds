# Logo candidates

Four directions drawn out of the watercolour-and-ink portrait in
`source-artwork.jpg` — the drawing rotated upright, nothing else changed.

`candidates.svg` holds the three drawn marks as `<symbol>` elements, ready to
inline in a page and call with `<use href="#id">`:

| Option | id         | What it is                                             |
| ------ | ---------- | ------------------------------------------------------ |
| A      | `tt-grin`  | The open grin on its own — lips, two rows of teeth      |
| B      | `tt-face`  | The whole face flattened, on the aubergine ground       |
| C      | `tt-bar`   | The chocolate bar with the bite out of it               |
| D      | —          | A crop of `source-artwork.jpg` itself, no redrawing     |

All three are built on a 100 × 100 viewBox and hold together down to 16 px.
Nothing here is wired into the site yet — one of them gets picked first, then
that one goes to the favicon, the brand card, the touch icon, the share card,
the pass header and the map pins.

Colours lifted from the painting:

    aubergine  #8E5C9C      lip      #A9707E
    sweater    #4A57AC      cocoa    #3B2A20
    skin       #F2E3B0      berry    #B41F2B
    ink        #241A1F      vanilla  #F4EAD2
