# photos/

One folder per place, named exactly like the `id` in `data/restaurants.json`:

```
photos/
  f-hoone/
    01.webp
    02.webp
  rataskaevu-16/
    01.webp
```

Then list the filenames — just the filenames, no paths — in that place's
`photos` array:

```json
"photos": ["01.webp", "02.webp"]
```

The order in the array is the order they appear in the grid and the lightbox.

Rules of thumb:

- **WebP**, quality around 80. JPEG, PNG and AVIF also work.
- Roughly **1600px on the long edge**. The grid shows small squares and the
  lightbox never needs more than that, so anything larger is just slower.
- Keep each file **under about 300 KB**.
- Photos are served straight from the repo, so every one of them lands in
  your Git history for good. Resize *before* committing.

`tools/validate.mjs` fails the build if the data lists a photo that is not
here, and warns about folders here that no place points at.

## Shrinking a phone photo

A photo straight off a phone is 4 to 8 MB and around 5000px wide. That is 20
times more than this site can use, and it would sit in the git history for
good. The recipe, which turned a 6.7 MB phone photo into 232 KB:

```python
# pip install pillow
from PIL import Image, ImageOps

im = ImageOps.exif_transpose(Image.open('IMG_1234.jpg'))  # bake the rotation in
im.thumbnail((1600, 1600), Image.LANCZOS)                 # long edge 1600

out = Image.new(im.mode, im.size)   # a fresh canvas carries no metadata:
out.paste(im)                       # no GPS, no serial number, no timestamp
out.save('01.webp', 'WEBP', quality=75, method=6)
```

Three things are doing the work, and each matters on its own:

- **`exif_transpose`.** Phones store the sensor image and a "rotate me" flag
  beside it. Browsers mostly honour the flag, but not every one does, and the
  flag is the first thing a stripping tool throws away. Rotating the pixels
  themselves removes the question.
- **1600px on the long edge.** The grid draws thumbnails and the lightbox
  never needs more. This is most of the saving.
- **A fresh canvas.** It drops the EXIF block, and with it the GPS
  coordinates of wherever the shutter was pressed. Photos here are public
  files in a public repo.

`quality=75` sits at the knee for busy street photos: 80 cost 55 KB more for
no visible difference. If a photo still lands over 300 KB at 75, drop the long
edge to 1400 rather than the quality.

A frame full of leaves is the expensive one. Foliage is high frequency detail
everywhere at once, which is exactly what a lossy codec cannot cheat on: one
tree photo here was still 399 KB at 1400 and only came under the line at 1200
and quality 70. That is the order to try it in, edge first and quality second,
and leaves are where quality 70 hides best anyway.

No Python to hand: [squoosh.app](https://squoosh.app/) does the same three
things in a browser tab and uploads nothing.
