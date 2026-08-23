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
